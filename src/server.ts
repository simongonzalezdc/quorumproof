/**
 * Dashboard server (dependency-free, node:http).
 *   npm run serve  → http://localhost:8787
 * Endpoints:
 *   GET  /            dashboard UI
 *   GET  /api/health  CC3 testnet block + Attestcoin attested heights (live)
 *   POST /api/assess  {txHash, chainKey?} → full deliberation trace
 *
 * Network posture:
 *   - Binds 127.0.0.1 by default. A non-loopback bind is an explicit opt-in
 *     (--host <addr> or QUORUMPROOF_HOST=<addr>); the opt-in is logged at
 *     startup, and it REQUIRES QUORUMPROOF_TOKEN — the server refuses to
 *     start otherwise.
 *   - When a token is configured, every route (including POST /api/assess,
 *     whose response carries the fleet roster) requires
 *     `Authorization: Bearer <token>`, compared in constant time.
 *   - Loopback callers with no token configured get the same responses as
 *     before this hardening.
 */
import { createServer, type Server } from 'node:http';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';
import { assessTx, demoScenarios, demoPolicy } from './pipeline.js';
import { cc3Provider, ETHEREUM_MAINNET_CHAINKEY, ETHEREUM_SEPOLIA_CHAINKEY } from './config.js';
import { fetchAttestedHeight } from './attest/gateway.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'web');
const DEFAULT_PORT = 8787;
/** Loopback-only unless the operator explicitly opts into a wider bind. */
export const DEFAULT_HOST = '127.0.0.1';

export type HostSource = 'default' | 'flag' | 'env';

export interface ServeConfig {
  host: string;
  port: number;
  /** Bearer token. Empty string = no auth (allowed only on loopback binds). */
  token: string;
  /** Where the bind host came from — surfaced in the opt-in log line. */
  hostSource: HostSource;
}

/** Thrown when a non-loopback bind is requested without QUORUMPROOF_TOKEN. */
export class BindPolicyError extends Error {}

/** A host is loopback iff it names the loopback interface, not a wildcard. */
export function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (h === 'localhost' || h === '::1') return true;
  return /^127(?:\.\d{1,3}){3}$/.test(h);
}

function readFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i !== -1 && i + 1 < argv.length) return argv[i + 1];
  const prefix = `${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

export function resolveServeConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv,
): ServeConfig {
  const flagHost = readFlag(argv, '--host');
  const envHost = env.QUORUMPROOF_HOST;
  const host = flagHost ?? envHost ?? DEFAULT_HOST;
  const hostSource: HostSource = flagHost !== undefined ? 'flag' : envHost !== undefined ? 'env' : 'default';

  const port = Number(readFlag(argv, '--port') ?? env.PORT ?? DEFAULT_PORT);
  const token = readFlag(argv, '--token') ?? env.QUORUMPROOF_TOKEN ?? '';

  if (!isLoopbackHost(host) && !token) {
    throw new BindPolicyError(
      `refusing to bind non-loopback host "${host}" (${hostSource}) without a token: ` +
        `the dashboard drives real outbound proof-building and returns the fleet roster. ` +
        `Set QUORUMPROOF_TOKEN (bearer auth) or bind loopback (default ${DEFAULT_HOST}).`,
    );
  }
  return { host, port, token, hostSource };
}

/** Constant-time bearer comparison: sha-256 both sides so lengths always match. */
function tokenMatches(presented: string, expected: string): boolean {
  if (!presented) return false;
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export interface ServerDeps {
  /** Pipeline entry point, injectable so tests can prove it never runs for unauthorized callers. */
  assess?: typeof assessTx;
}

export function createDashboardServer(config: ServeConfig, deps: ServerDeps = {}): Server {
  const assess = deps.assess ?? assessTx;
  const authRequired = config.token !== '';
  const PORT = config.port;

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    if (authRequired) {
      const presented = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization ?? ''))?.[1] ?? '';
      if (!tokenMatches(presented, config.token)) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="quorumproof"',
        });
        res.end(JSON.stringify({ error: 'unauthorized: missing or invalid bearer token' }));
        return;
      }
    }
    try {
      if (url.pathname === '/api/health') {
        const [attestedMainnet, attestedSepolia, block] = await Promise.all([
          fetchAttestedHeight(ETHEREUM_MAINNET_CHAINKEY),
          fetchAttestedHeight(ETHEREUM_SEPOLIA_CHAINKEY),
          cc3Provider().getBlockNumber(),
        ]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            chain: 'Creditcoin CC3 testnet',
            cc3Block: block,
            attestedHeights: {
              ethereumMainnet: attestedMainnet ?? null,
              ethereumSepolia: attestedSepolia ?? null,
            },
            scenarios: demoScenarios(),
            policy: {
              ...demoPolicy(),
              expectedAmountWei: demoPolicy().expectedAmountWei.toString(),
              minAmountWei: demoPolicy().minAmountWei.toString(),
            },
          }),
        );
        return;
      }

      if (url.pathname === '/api/assess' && req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const { txHash, chainKey } = JSON.parse(body || '{}') as { txHash?: string; chainKey?: number };
        if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'txHash must be a 32-byte hex transaction hash' }));
          return;
        }
        const result = await assess({ txHash, chainKey: chainKey ?? ETHEREUM_MAINNET_CHAINKEY });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result, (_, v) => (typeof v === 'bigint' ? `0x${v.toString(16)}` : v)));
        return;
      }

      // static files
      const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = join(ROOT, rel);
      if (existsSync(file) && file.startsWith(ROOT)) {
        res.writeHead(200, { 'Content-Type': MIME[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream' });
        res.end(readFileSync(file));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

/** True when this module is the process entry (tsx/node), false under vitest. */
function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  let config: ServeConfig;
  try {
    config = resolveServeConfig();
  } catch (e) {
    console.error(`QuorumProof dashboard: ${(e as Error).message}`);
    process.exit(1);
  }
  const server = createDashboardServer(config);
  server.listen(config.port, config.host, () => {
    const addr = server.address();
    const bound = typeof addr === 'object' && addr ? `${addr.address}:${addr.port}` : `${config.host}:${config.port}`;
    console.log(`QuorumProof dashboard: http://localhost:${config.port} (bound to ${bound})`);
    if (!isLoopbackHost(config.host)) {
      console.warn(
        `[security] non-loopback bind opt-in (${config.hostSource}): listening on ${bound} — ` +
          `reachable beyond this machine; bearer-token auth (QUORUMPROOF_TOKEN) is REQUIRED on every route`,
      );
    }
  });
}
