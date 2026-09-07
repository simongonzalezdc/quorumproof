/**
 * Dashboard server (dependency-free, node:http).
 *   npm run serve  → http://localhost:8787
 * Endpoints:
 *   GET  /            dashboard UI
 *   GET  /api/health  CC3 testnet block + Attestcoin attested heights (live)
 *   POST /api/assess  {txHash, chainKey?} → full deliberation trace
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessTx, demoScenarios, demoPolicy } from './pipeline.js';
import { cc3Provider, ETHEREUM_MAINNET_CHAINKEY, ETHEREUM_SEPOLIA_CHAINKEY } from './config.js';
import { fetchAttestedHeight } from './attest/gateway.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'web');
const PORT = Number(process.env.PORT ?? 8787);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
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
      const result = await assessTx({ txHash, chainKey: chainKey ?? ETHEREUM_MAINNET_CHAINKEY });
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

server.listen(PORT, () => {
  console.log(`QuorumProof dashboard: http://localhost:${PORT}`);
});
