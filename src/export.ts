/**
 * Certificate persistence — the durable side of a quorum decision.
 *
 * Write: writeCertificate() serializes the FULL deliberation trace (fact,
 *        policy, both rounds of signed ballots, certificate including
 *        certHash, timings) plus the enforcement context into a JSON
 *        envelope at a user-chosen path, and/or the rendered certificate
 *        text next to it.
 * Read:  readCertificate() parses the envelope back into a runtime
 *        DeliberationTrace that drops straight into
 *        auditCertificateSignatures(trace) — offline, no network, no chain.
 *
 * Encoding: bigint values are written as 0x-prefixed hex strings — the same
 * lossless encoding the HTTP layer uses (src/server.ts) and the committed
 * seed traces use (src/web/seed-trace.json). Read-back revives exactly the
 * three bigint fields a trace carries (fact.valueWei,
 * policy.expectedAmountWei, policy.minAmountWei) and refuses files where
 * they did not survive as strings — no silent precision loss in either
 * direction. The certificate's own format (fields, digests, hashing) is
 * untouched: this module only wraps and unwraps it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DeliberationTrace } from './agents/types.js';
import { renderCertificate, type SubmissionResult } from './chain/registry.js';

export const CERTIFICATE_FORMAT = 'quorumproof-certificate' as const;
export const CERTIFICATE_VERSION = 1;

export type CertificateFormat = 'json' | 'text' | 'both';

/**
 * bigint → `0x` hex — the one canonical lossless JSON encoding for this repo
 * (HTTP responses, seed traces, and exported certificates all agree).
 */
export function bigintJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? `0x${value.toString(16)}` : value;
}

/** The only bigint fields in a DeliberationTrace; nothing else is revived. */
const BIGINT_KEYS: readonly string[] = ['valueWei', 'expectedAmountWei', 'minAmountWei'];

function reviveBigints(node: unknown, where: string): unknown {
  if (Array.isArray(node)) {
    return node.map((v, i) => reviveBigints(v, `${where}[${i}]`));
  }
  if (node !== null && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (BIGINT_KEYS.includes(k)) {
        if (typeof v !== 'string') {
          throw new Error(`${where}.${k}: expected a string-encoded bigint, got ${v === null ? 'null' : typeof v}`);
        }
        try {
          out[k] = BigInt(v);
        } catch {
          throw new Error(`${where}.${k}: not a valid bigint encoding: ${v}`);
        }
      } else {
        out[k] = reviveBigints(v, `${where}.${k}`);
      }
    }
    return out;
  }
  return node;
}

/** The JSON envelope on disk. `trace` is the runtime form after readCertificate(). */
export interface CertificateEnvelope {
  format: typeof CERTIFICATE_FORMAT;
  version: number;
  exportedAt: string;
  tool: { name: string; version: string };
  /** convenience copies so a shelf of files answers ls/grep; the trace is the source of truth */
  txHash: string;
  label?: string;
  decision: 'EXECUTE' | 'REJECT';
  factHash: string;
  certHash: string;
  /** how the certificate was enforced when it was exported */
  enforcement: SubmissionResult | null;
  trace: DeliberationTrace;
}

/** package.json of this tool, found by climbing from the module (src/ or dist/src/). */
function toolVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
      try {
        const pkg: unknown = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        if ((pkg as { name?: string })?.name === 'quorumproof') {
          return String((pkg as { version?: string }).version ?? 'unknown');
        }
      } catch {
        /* no package.json here — keep climbing */
      }
      dir = dirname(dir);
    }
  } catch {
    /* import.meta.url not a file URL — leave unknown */
  }
  return 'unknown';
}

export interface WriteCertificateOptions {
  trace: DeliberationTrace;
  /** enforcement result to record alongside the trace (optional) */
  enforcement?: SubmissionResult | null;
  /** the user-chosen output path */
  outPath: string;
  /** export format; defaults to 'json' */
  format?: CertificateFormat;
  /** human label for the proceeding (scenario name or tx hash) */
  label?: string;
  /** ISO timestamp; tests may pin it for byte-stable files */
  exportedAt?: string;
}

/** For --format both: the text twin of a JSON path (cert.json → cert.txt). */
export function textSiblingPath(outPath: string): string {
  return outPath.endsWith('.json') ? `${outPath.slice(0, -'.json'.length)}.txt` : `${outPath}.txt`;
}

export function buildCertificateEnvelope(opts: WriteCertificateOptions): CertificateEnvelope {
  const { trace } = opts;
  return {
    format: CERTIFICATE_FORMAT,
    version: CERTIFICATE_VERSION,
    exportedAt: opts.exportedAt ?? new Date().toISOString(),
    tool: { name: 'quorumproof', version: toolVersion() },
    txHash: trace.fact.txHash,
    ...(opts.label !== undefined ? { label: opts.label } : {}),
    decision: trace.certificate.decision,
    factHash: trace.certificate.factHash,
    certHash: trace.certificate.certHash,
    enforcement: opts.enforcement ?? null,
    trace,
  };
}

/**
 * Write the certificate for one proceeding. Returns the paths written, in
 * write order: json (or text) at outPath, and for 'both' the text rendering
 * at textSiblingPath(outPath). Throws on unwritable paths — callers decide
 * whether that fails the run.
 */
export function writeCertificate(opts: WriteCertificateOptions): string[] {
  const format = opts.format ?? 'json';
  const written: string[] = [];
  if (format === 'json' || format === 'both') {
    const envelope = buildCertificateEnvelope(opts);
    writeFileSync(opts.outPath, `${JSON.stringify(envelope, bigintJsonReplacer, 2)}\n`);
    written.push(opts.outPath);
  }
  if (format === 'text' || format === 'both') {
    const textPath = format === 'both' ? textSiblingPath(opts.outPath) : opts.outPath;
    writeFileSync(textPath, `${renderCertificate(opts.trace.certificate)}\n`);
    written.push(textPath);
  }
  return written;
}

/**
 * Read a certificate file back into an auditable trace:
 *   const env = readCertificate('cert.json');
 *   auditCertificateSignatures(env.trace);   // offline
 * Rejects non-envelope files, wrong versions, and files whose bigint fields
 * did not survive as string encodings.
 */
export function readCertificate(path: string): CertificateEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path}: cannot be read as JSON (${(e as Error).message})`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${path}: not a ${CERTIFICATE_FORMAT} file`);
  }
  const raw = parsed as Record<string, unknown>;
  if (raw.format !== CERTIFICATE_FORMAT) {
    throw new Error(`${path}: not a ${CERTIFICATE_FORMAT} file (format: ${String(raw.format ?? 'missing')})`);
  }
  if (raw.version !== CERTIFICATE_VERSION) {
    throw new Error(`${path}: unsupported certificate version ${String(raw.version)} (expected ${CERTIFICATE_VERSION})`);
  }
  const trace = reviveBigints(raw.trace, `${path}: trace`) as DeliberationTrace;
  if (
    typeof trace?.fact?.factHash !== 'string' ||
    !Array.isArray(trace?.rounds) ||
    !Array.isArray(trace?.certificate?.votes)
  ) {
    throw new Error(`${path}: trace is missing fact/rounds/certificate — not auditable`);
  }
  if (
    typeof trace.fact.valueWei !== 'bigint' ||
    typeof trace.policy?.expectedAmountWei !== 'bigint' ||
    typeof trace.policy?.minAmountWei !== 'bigint'
  ) {
    throw new Error(
      `${path}: bigint fields (valueWei/expectedAmountWei/minAmountWei) did not revive — the encoding is not lossless`,
    );
  }
  return { ...raw, trace } as CertificateEnvelope;
}
