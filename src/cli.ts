/**
 * CLI argument parsing for the demo/export entry (src/index.ts).
 * Pure and offline-testable — nothing here touches the network, so the
 * argument surface is fully covered by `npm test` even though a real run
 * needs the Attestcoin proof service.
 *
 *   npm run demo                                          both demo scenarios (stdout)
 *   npm run demo -- 0xTXX…                                one proceeding (stdout)
 *   npm run demo -- 0xTXX… --out cert.json                write the certificate (JSON, default)
 *   npm run demo -- 0xTXX… --out cert.txt --format text   rendered certificate text
 *   npm run demo -- 0xTXX… --out cert.json --format both  cert.json + cert.txt beside it
 */
import type { CertificateFormat } from './export.js';

export interface CliOptions {
  /** explicit transaction hash; absent = run both demo scenarios */
  txHash?: string;
  /** user-chosen output path for --out */
  outPath?: string;
  /** export format; only meaningful together with outPath */
  format: CertificateFormat;
  /** --help / -h */
  help: boolean;
}

export type ParsedCli = { ok: true; options: CliOptions } | { ok: false; error: string };

export const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export const USAGE = `Usage:
  npm run demo                                  run both demo scenarios (stdout, unchanged)
  npm run demo -- <txHash>                      assess one transaction (stdout, unchanged)
  npm run demo -- <txHash> --out <path>         write the certificate as JSON (default format)
  npm run demo -- <txHash> --out <path> --format <json|text|both>
                                                json — full audit envelope: fact, policy, both
                                                       rounds of signed ballots, certificate
                                                       and certHash (bigint-safe 0x-hex)
                                                text — the rendered certificate text
                                                both — JSON at <path> plus the text rendering
                                                       beside it (.json swapped for .txt)

The JSON file reads back offline: auditCertificateSignatures verifies every
ballot signature with no network and no chain access (src/export.ts).`;

const FORMATS: CertificateFormat[] = ['json', 'text', 'both'];

export function parseCliArgs(argv: string[]): ParsedCli {
  const options: CliOptions = { format: 'json', help: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === '--help' || a === '-h') {
      options.help = true;
      continue;
    }

    if (a === '--out' || a === '-o') {
      const value = argv[++i];
      if (!value) return { ok: false, error: `${a} requires a file path (e.g. --out certificate.json)` };
      if (value === '-') return { ok: false, error: '--out - is not supported; without --out the certificate prints to stdout' };
      if (value.endsWith('/')) return { ok: false, error: `--out expects a file path, but "${value}" ends with "/"` };
      options.outPath = value;
      continue;
    }

    if (a === '--format' || a === '-f') {
      const value = argv[++i];
      if (!value) return { ok: false, error: `${a} requires one of: ${FORMATS.join(', ')}` };
      if (!FORMATS.includes(value as CertificateFormat)) {
        return { ok: false, error: `unknown --format "${value}" (expected one of: ${FORMATS.join(', ')})` };
      }
      options.format = value as CertificateFormat;
      continue;
    }

    if (a.startsWith('-') && a !== '-') {
      return { ok: false, error: `unknown option "${a}"` };
    }

    positional.push(a);
  }

  if (positional.length > 1) {
    return { ok: false, error: `expected at most one transaction hash, got ${positional.length} positional arguments` };
  }

  const txHash = positional[0];
  if (txHash !== undefined && !TX_HASH_RE.test(txHash)) {
    return { ok: false, error: `not a transaction hash: ${txHash} (expected 0x + 64 hex characters)` };
  }
  options.txHash = txHash;

  if (options.format !== 'json' && !options.outPath) {
    return { ok: false, error: `--format ${options.format} requires --out (without it, the certificate prints to stdout)` };
  }

  if (options.outPath && options.txHash === undefined) {
    return {
      ok: false,
      error:
        '--out needs a single proceeding: pass a transaction hash (npm run demo -- <txHash> --out <path>). ' +
        'The two-scenario demo would otherwise write two certificates over one path.',
    };
  }

  return { ok: true, options };
}
