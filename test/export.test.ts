/**
 * Offline certificate-export tests — no network. A synthetic trace is
 * deliberated locally (fake Attestcoin fact, deterministic fleet), written
 * to disk with writeCertificate(), and read back with readCertificate();
 * the revived trace must drop into the existing auditCertificateSignatures()
 * path and pass it, with bigint values surviving the file exactly.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Fleet, auditCertificateSignatures } from '../src/agents/fleet.js';
import { demoPolicy } from '../src/pipeline.js';
import { computeFactHash } from '../src/attest/gateway.js';
import { renderCertificate } from '../src/chain/registry.js';
import type { AttestedFact } from '../src/agents/types.js';
import { parseCliArgs } from '../src/cli.js';
import {
  bigintJsonReplacer,
  CERTIFICATE_FORMAT,
  readCertificate,
  textSiblingPath,
  writeCertificate,
} from '../src/export.js';

function fakeFact(overrides: Partial<AttestedFact> = {}): AttestedFact {
  const base = {
    chainKey: 3,
    headerNumber: 25_914_979,
    txIndex: 23,
    txHash: '0x' + 'ab'.repeat(32),
    verified: true,
    verifiedVia: 'test harness (offline)',
    from: '0x9395704E478EB664D5Eb58ecfcf7031724cF367B',
    to: '0x172AC97E50915292F2B3E8B56f6b4DDf80aC0489',
    valueWei: 3_599_966_400_000_000_000n, // 3.5999664 ETH
    calldata: '0x',
    txType: 0,
    receiptStatus: 1,
    factHash: computeFactHash({
      chainKey: 3,
      headerNumber: 25_914_979,
      txHash: '0x' + 'ab'.repeat(32),
      verified: true,
    }),
  };
  return { ...base, ...overrides };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qp-cert-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function deliberate(): Promise<ReturnType<Fleet['deliberate']>> {
  const fleet = new Fleet();
  return fleet.deliberate(fakeFact(), demoPolicy());
}

const ENFORCEMENT = { mode: 'local' as const, verified: true, failures: [], note: 'local enforcement (test)' };

describe('certificate export round-trip (offline)', () => {
  it('writes a JSON envelope that reads back and passes the offline signature audit', async () => {
    const trace = await deliberate();
    const out = join(dir, 'cert.json');
    const written = writeCertificate({ trace, enforcement: ENFORCEMENT, outPath: out, format: 'json' });
    expect(written).toEqual([out]);

    const env = readCertificate(out);
    expect(env.format).toBe(CERTIFICATE_FORMAT);
    expect(env.version).toBe(1);
    expect(env.trace.fact.factHash).toBe(trace.fact.factHash);
    expect(env.trace.certificate.certHash).toBe(trace.certificate.certHash);

    // AC: re-readable — the existing audit path, no network, no chain access
    const audit = auditCertificateSignatures(env.trace);
    expect(audit.ok).toBe(true);
    expect(audit.failures).toEqual([]);
  });

  it('bigint values survive the file exactly: 0x-hex on disk, bigint after read', async () => {
    const trace = await deliberate();
    const out = join(dir, 'cert.json');
    writeCertificate({ trace, outPath: out });

    const env = readCertificate(out);
    expect(env.trace.fact.valueWei).toBe(trace.fact.valueWei);
    expect(env.trace.policy.expectedAmountWei).toBe(trace.policy.expectedAmountWei);
    expect(env.trace.policy.minAmountWei).toBe(trace.policy.minAmountWei);
    expect(typeof env.trace.fact.valueWei).toBe('bigint');

    // the FILE carries the lossless encoding — not the revival papering over it
    const onDisk = JSON.parse(readFileSync(out, 'utf8'));
    expect(onDisk.trace.fact.valueWei).toMatch(/^0x[0-9a-f]+$/);
    expect(BigInt(onDisk.trace.fact.valueWei)).toBe(trace.fact.valueWei);
    expect(onDisk.trace.policy.expectedAmountWei).toBe('0x31f5c4ed27680000'); // 3.6 ETH, pinned
  });

  it('the envelope carries the full audit trail, not a summary', async () => {
    const trace = await deliberate();
    const out = join(dir, 'cert.json');
    writeCertificate({ trace, enforcement: ENFORCEMENT, outPath: out, label: 'repayment-received' });

    const onDisk = JSON.parse(readFileSync(out, 'utf8'));
    expect(onDisk.format).toBe('quorumproof-certificate');
    expect(onDisk.version).toBe(1);
    expect(onDisk.tool.name).toBe('quorumproof');
    expect(onDisk.label).toBe('repayment-received');
    expect(onDisk.txHash).toBe(trace.fact.txHash);
    // fact
    expect(onDisk.trace.fact.factHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    // policy
    expect(onDisk.trace.policy.lender).toBe(demoPolicy().lender);
    // both rounds of votes, each signature a full 65-byte EIP-191 signature
    expect(onDisk.trace.rounds).toHaveLength(2);
    for (const r of onDisk.trace.rounds) {
      expect(r.votes).toHaveLength(3);
      for (const v of r.votes) expect(v.signature).toMatch(/^0x[0-9a-f]{130}$/);
    }
    // certificate + cert hash
    expect(onDisk.trace.certificate.votes).toHaveLength(6);
    expect(onDisk.trace.certificate.certHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(onDisk.certHash).toBe(onDisk.trace.certificate.certHash);
    expect(onDisk.decision).toBe('EXECUTE');
    // enforcement context
    expect(onDisk.enforcement.mode).toBe('local');
  });

  it('a tampered certificate file fails the offline audit', async () => {
    const trace = await deliberate();
    const out = join(dir, 'cert.json');
    writeCertificate({ trace, outPath: out });

    // flip ledger-01's round-2 vote on disk, without its signature covering it
    const onDisk = JSON.parse(readFileSync(out, 'utf8'));
    onDisk.trace.certificate.votes = onDisk.trace.certificate.votes.map((v: { agentId: string; round: number }) =>
      v.agentId === 'ledger-01' && v.round === 2 ? { ...v, vote: 'DENY' } : v,
    );
    writeFileSync(out, JSON.stringify(onDisk, bigintJsonReplacer, 2));

    const audit = auditCertificateSignatures(readCertificate(out).trace);
    expect(audit.ok).toBe(false);
    expect(audit.failures.join(' ')).toMatch(/ledger-01/);
  });

  it('text format writes the rendered certificate; both writes the JSON and its text twin', async () => {
    const trace = await deliberate();

    const txt = join(dir, 'cert.txt');
    expect(writeCertificate({ trace, outPath: txt, format: 'text' })).toEqual([txt]);
    expect(readFileSync(txt, 'utf8')).toBe(`${renderCertificate(trace.certificate)}\n`);

    const both = join(dir, 'both.json');
    const written = writeCertificate({ trace, outPath: both, format: 'both' });
    expect(written).toEqual([both, textSiblingPath(both)]);
    expect(textSiblingPath(both)).toBe(join(dir, 'both.txt'));
    expect(existsSync(join(dir, 'both.txt'))).toBe(true);
    expect(readFileSync(join(dir, 'both.txt'), 'utf8')).toBe(`${renderCertificate(trace.certificate)}\n`);
    expect(readCertificate(both).trace.certificate.certHash).toBe(trace.certificate.certHash);
  });

  it('readCertificate rejects foreign files and lossy bigint encodings', async () => {
    const trace = await deliberate();

    const foreign = join(dir, 'foreign.json');
    writeFileSync(foreign, JSON.stringify({ hello: 'world' }));
    expect(() => readCertificate(foreign)).toThrow(/not a quorumproof-certificate file/);

    const lossy = join(dir, 'lossy.json');
    writeCertificate({ trace, outPath: lossy });
    const parsed = JSON.parse(readFileSync(lossy, 'utf8'));
    parsed.trace.fact.valueWei = 3_599_966_400_000_000_000; // JSON number, not an encoding
    writeFileSync(lossy, JSON.stringify(parsed));
    expect(() => readCertificate(lossy)).toThrow(/valueWei/);

    const garbage = join(dir, 'garbage.json');
    writeCertificate({ trace, outPath: garbage });
    const parsed2 = JSON.parse(readFileSync(garbage, 'utf8'));
    parsed2.trace.policy.expectedAmountWei = 'zzz';
    writeFileSync(garbage, JSON.stringify(parsed2));
    expect(() => readCertificate(garbage)).toThrow(/expectedAmountWei/);
  });
});

describe('cli argument parsing', () => {
  const TX = '0x' + 'ab'.repeat(32);

  it('no arguments: both demo scenarios, stdout — the default is unchanged', () => {
    const r = parseCliArgs([]);
    expect(r).toEqual({ ok: true, options: { format: 'json', help: false } });
  });

  it('a lone tx hash parses (previous single-tx behaviour)', () => {
    const r = parseCliArgs([TX]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.options.txHash).toBe(TX);
      expect(r.options.outPath).toBeUndefined();
    }
  });

  it('--out and --format parse in any order around the tx hash', () => {
    const r = parseCliArgs(['--out', 'c.json', TX, '--format', 'both']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.options.outPath).toBe('c.json');
      expect(r.options.format).toBe('both');
      expect(r.options.txHash).toBe(TX);
    }
  });

  it('short flags -o/-f work too', () => {
    const r = parseCliArgs([TX, '-o', 'c.txt', '-f', 'text']);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.options.outPath).toBe('c.txt');
      expect(r.options.format).toBe('text');
    }
  });

  it('refuses --format without --out', () => {
    const r = parseCliArgs([TX, '--format', 'text']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/--format text requires --out/);
  });

  it('refuses --out without a tx hash: the two-scenario demo would write two certificates over one path', () => {
    const r = parseCliArgs(['--out', 'c.json']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/single proceeding/);
  });

  it('refuses unknown formats, unknown flags, missing values, trailing-slash and dash-dash paths', () => {
    expect(parseCliArgs([TX, '--out', 'c.json', '--format', 'pdf']).ok).toBe(false);
    expect(parseCliArgs([TX, '--bogus']).ok).toBe(false);
    expect(parseCliArgs([TX, '--out']).ok).toBe(false);
    expect(parseCliArgs([TX, '--out', 'dir/']).ok).toBe(false);
    expect(parseCliArgs([TX, '--out', '-']).ok).toBe(false);
  });

  it('refuses malformed or surplus positional arguments', () => {
    expect(parseCliArgs(['not-a-hash']).ok).toBe(false);
    expect(parseCliArgs([TX, TX]).ok).toBe(false);
  });

  it('--help / -h sets the help flag', () => {
    expect(parseCliArgs(['--help']).ok).toBe(true);
    expect(parseCliArgs(['-h']).ok).toBe(true);
  });
});
