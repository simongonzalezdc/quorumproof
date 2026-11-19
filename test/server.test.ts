/**
 * Access-control tests for the dashboard server — offline, no network.
 *
 * A tool-surface audit (2026-11) measured the server listening on `*:8787`
 * with no auth: any LAN/tailnet host could POST /api/assess, drive real
 * outbound proof-building, and read the fleet roster. These tests pin the
 * hardened posture:
 *   1. loopback-only bind by default — a non-loopback TCP connect is refused
 *   2. a non-loopback bind refuses to start without QUORUMPROOF_TOKEN
 *   3. with a token configured, an unauthorized POST /api/assess gets 401
 *      and the pipeline (outbound proof-building) never runs
 *   4. loopback callers with no token configured keep the old behavior
 */
import { afterAll, describe, expect, it } from 'vitest';
import { type Server } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import {
  BindPolicyError,
  DEFAULT_HOST,
  createDashboardServer,
  isLoopbackHost,
  resolveServeConfig,
  type ServeConfig,
} from '../src/server.js';
import type { AssessResult } from '../src/pipeline.js';

const servers: Server[] = [];
afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r()))));
});

function startServer(opts: { host: string; token: string; assess?: (o: { txHash: string }) => Promise<AssessResult> }) {
  const server = createDashboardServer(
    { host: opts.host, port: 0, token: opts.token, hostSource: 'flag' },
    opts.assess ? { assess: opts.assess } : {},
  );
  servers.push(server);
  return new Promise<{ server: Server; port: number; address: string }>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, opts.host, () => {
      const a = server.address() as net.AddressInfo;
      resolve({ server, port: a.port, address: a.address });
    });
  });
}

/** Non-internal, non-loopback IPv4 addresses of this host (may be empty on odd CI runners). */
function lanIPv4s(): string[] {
  const out: string[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('127.')) out.push(iface.address);
    }
  }
  return [...new Set(out)];
}

/** 'connected' iff a TCP connection succeeded; otherwise the error code / 'timeout'. */
function connectOutcome(host: string, port: number, ms = 1500): Promise<string> {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (v: string) => {
      s.destroy();
      resolve(v);
    };
    s.setTimeout(ms, () => done('timeout'));
    s.on('connect', () => done('connected'));
    s.on('error', (e: NodeJS.ErrnoException) => done(e.code ?? 'error'));
  });
}

async function request(
  method: string,
  url: string,
  body?: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; text: string; ms: number; contentType: string }> {
  const t0 = Date.now();
  const r = await fetch(url, { method, body, headers });
  const text = await r.text();
  return { status: r.status, text, ms: Date.now() - t0, contentType: r.headers.get('content-type') ?? '' };
}

const VALID_TX = `0x${'ab'.repeat(32)}`;
const TOKEN = 'test-token-3f9a';

/** Counting pipeline stub — records calls, never touches the network. */
function assessStub(): { calls: { txHash: string }[]; assess: () => Promise<AssessResult> } {
  const calls: { txHash: string }[] = [];
  return {
    calls,
    assess: (async (opts: { txHash: string }) => {
      calls.push({ txHash: opts.txHash });
      return {
        trace: { note: 'stubbed' },
        submission: { note: 'stubbed' },
        fleetRoster: [{ agentId: 'ledger-01', agentAddress: '0xABC0000000000000000000000000000000000001', charter: 'repayment ledger', kind: 'deterministic' }],
        llmEnabled: false,
      } as unknown as AssessResult;
    }) as () => Promise<AssessResult>,
  };
}

describe('serve config resolution', () => {
  it('defaults to loopback, no auth, port 8787', () => {
    const c = resolveServeConfig({}, ['/usr/bin/node', '/repo/src/server.ts']);
    expect(c.host).toBe(DEFAULT_HOST);
    expect(c.hostSource).toBe('default');
    expect(c.port).toBe(8787);
    expect(c.token).toBe('');
  });

  it('refuses a non-loopback bind without a token', () => {
    expect(() => resolveServeConfig({ QUORUMPROOF_HOST: '0.0.0.0' }, [])).toThrow(BindPolicyError);
    expect(() => resolveServeConfig({ QUORUMPROOF_HOST: '192.168.1.5' }, [])).toThrow(/QUORUMPROOF_TOKEN/);
  });

  it('accepts a non-loopback bind when a token is set', () => {
    const c = resolveServeConfig({ QUORUMPROOF_HOST: '0.0.0.0', QUORUMPROOF_TOKEN: 'k' }, []);
    expect(c.host).toBe('0.0.0.0');
    expect(c.hostSource).toBe('env');
    expect(c.token).toBe('k');
  });

  it('--host/--token flags (space and = forms) win over env', () => {
    const space = resolveServeConfig(
      { QUORUMPROOF_HOST: '10.0.0.9', QUORUMPROOF_TOKEN: 'envtok' },
      ['node', 'server.ts', '--host', '0.0.0.0', '--token', 'flagtok'],
    );
    expect(space).toMatchObject({ host: '0.0.0.0', token: 'flagtok', hostSource: 'flag' });
    const eq = resolveServeConfig({}, ['node', 'server.ts', '--host=192.168.0.2', '--token=eqtok']);
    expect(eq).toMatchObject({ host: '192.168.0.2', token: 'eqtok' });
  });

  it('loopback classification', () => {
    for (const h of ['127.0.0.1', '127.5.4.3', 'localhost', '::1', 'LOCALHOST']) expect(isLoopbackHost(h)).toBe(true);
    for (const h of ['0.0.0.0', '::', '192.168.1.5', '100.92.68.103', 'example.com', '']) expect(isLoopbackHost(h)).toBe(false);
  });
});

describe('default posture: loopback only', () => {
  it('binds 127.0.0.1 by default and serves loopback', async () => {
    const { server, port, address } = await startServer({ host: DEFAULT_HOST, token: '' });
    expect(address).toBe('127.0.0.1');
    const r = await request('GET', `http://127.0.0.1:${port}/`);
    expect(r.status).toBe(200);
    expect(r.contentType).toContain('text/html');
    expect(server.listening).toBe(true);
  });

  it('does not accept a non-loopback connection', async () => {
    const { port } = await startServer({ host: DEFAULT_HOST, token: '' });
    const lans = lanIPv4s().slice(0, 3);
    if (lans.length === 0) {
      console.warn('no non-loopback IPv4 interface found on this runner; asserting bind address only');
      return;
    }
    for (const ip of lans) {
      const outcome = await connectOutcome(ip, port);
      // ECONNREFUSED on a normal host; timeout/unreachable on firewalled runners.
      // Any of those proves the socket never accepted a non-loopback peer.
      expect(outcome).not.toBe('connected');
    }
  });
});

describe('loopback callers keep the old behavior (no token configured)', () => {
  it('POST /api/assess with a malformed txHash gets the same 400 as before', async () => {
    const { port } = await startServer({ host: DEFAULT_HOST, token: '' });
    for (const body of ['{}', JSON.stringify({ txHash: 'not-a-hash' })]) {
      const r = await request('POST', `http://127.0.0.1:${port}/api/assess`, body, { 'Content-Type': 'application/json' });
      expect(r.status).toBe(400);
      expect(JSON.parse(r.text).error).toBe('txHash must be a 32-byte hex transaction hash');
    }
  });
});

describe('token-gated mode (non-loopback bind)', () => {
  it('rejects an unauthorized POST /api/assess with 401 and never runs the pipeline', async () => {
    const lan = lanIPv4s()[0];
    const host = lan ?? '0.0.0.0';
    const dial = lan ?? '127.0.0.1';
    const stub = assessStub();
    const { port } = await startServer({ host, token: TOKEN, assess: stub.assess });

    const noHeader = await request('POST', `http://${dial}:${port}/api/assess`, JSON.stringify({ txHash: VALID_TX }), {
      'Content-Type': 'application/json',
    });
    expect(noHeader.status).toBe(401);
    expect(JSON.parse(noHeader.text).error).toMatch(/unauthorized/);
    expect(noHeader.text).not.toContain('fleetRoster');
    expect(noHeader.ms).toBeLessThan(1500); // 401 returns before any outbound proof-building
    expect(noHeader.contentType).toContain('application/json');

    const wrong = await request('POST', `http://${dial}:${port}/api/assess`, JSON.stringify({ txHash: VALID_TX }), {
      'Content-Type': 'application/json',
      Authorization: 'Bearer wrong-token',
    });
    expect(wrong.status).toBe(401);

    expect(stub.calls).toHaveLength(0); // AC3/AC5b: the pipeline did not run
  });

  it('gates the dashboard UI and every other route too (roster stays private)', async () => {
    const lan = lanIPv4s()[0];
    const host = lan ?? '0.0.0.0';
    const dial = lan ?? '127.0.0.1';
    const { port } = await startServer({ host, token: TOKEN });
    const r = await request('GET', `http://${dial}:${port}/`);
    expect(r.status).toBe(401);
    expect(r.text).not.toContain('fleetRoster');
  });

  it('an authorized caller passes the gate; response shape is unchanged', async () => {
    const stub = assessStub();
    const { port } = await startServer({ host: '0.0.0.0', token: TOKEN, assess: stub.assess });

    // malformed txHash + valid token: auth passes, validation still rejects, no pipeline
    const bad = await request('POST', `http://127.0.0.1:${port}/api/assess`, JSON.stringify({ txHash: 'zz' }), {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    });
    expect(bad.status).toBe(400);
    expect(stub.calls).toHaveLength(0);

    // valid txHash + valid token: pipeline runs exactly once, roster passthrough
    const ok = await request('POST', `http://127.0.0.1:${port}/api/assess`, JSON.stringify({ txHash: VALID_TX }), {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    });
    expect(ok.status).toBe(200);
    const body = JSON.parse(ok.text) as { fleetRoster: unknown[]; trace: unknown };
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.txHash).toBe(VALID_TX);
    expect(Array.isArray(body.fleetRoster)).toBe(true);
    expect(body.trace).toBeDefined();
  });
});

describe('token-gated mode on loopback (defense in depth)', () => {
  it('still requires the bearer token when bound to 127.0.0.1', async () => {
    const stub = assessStub();
    const { port } = await startServer({ host: '127.0.0.1', token: TOKEN, assess: stub.assess });
    const r = await request('POST', `http://127.0.0.1:${port}/api/assess`, JSON.stringify({ txHash: VALID_TX }), {
      'Content-Type': 'application/json',
    });
    expect(r.status).toBe(401);
    expect(stub.calls).toHaveLength(0);
  });
});
