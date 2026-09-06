/**
 * verify-live.ts — CLI wrapper around the AttestcoinGateway.
 *
 * Proves the mandatory Attestcoin integration live, end to end, with zero
 * tokens and zero private keys (all calls are reads: REST + eth_call):
 *   1. CC3 testnet attested height for the source chain (proof-builder REST).
 *   2. Inclusion + continuity proof via the hosted Attestcoin ProofBuilder.
 *   3. Verification against the BlockProver precompile (0x...FD2) ON Creditcoin
 *      CC3 testnet via eth_call (staticCall) — real on-chain verification.
 *   4. Decoding of the verified txBytes by the on-chain EvmV1Decoder library.
 *
 * Usage:
 *   npm run verify-live                     # default demo tx (Ethereum mainnet)
 *   npm run verify-live -- <txHash> [chainKey]
 *   TX_HASH=0x... SOURCE_CHAIN_KEY=3 npm run verify-live
 */
import { attestTx } from '../src/attest/gateway.js';
import { CC3_TESTNET_RPC, ETHEREUM_MAINNET_CHAINKEY } from '../src/config.js';

const DEFAULT_TX = '0x27e55494f572f31c46a79d83de58b8c60cded05185f25637a6f8a710e23d80d7';

async function main(): Promise<void> {
  const txHash = process.argv[2] ?? process.env.TX_HASH ?? DEFAULT_TX;
  const chainKey = Number(process.argv[3] ?? process.env.SOURCE_CHAIN_KEY ?? ETHEREUM_MAINNET_CHAINKEY);

  console.log(`CC3 testnet RPC: ${CC3_TESTNET_RPC}`);
  console.log(`Proving source tx ${txHash} (chainKey ${chainKey}) …`);

  const { fact, proofMs, verifyMs, decodeMs } = await attestTx(txHash, chainKey);

  console.log(`[1] attested height (chainKey ${chainKey}): ${fact.attestedHeight}`);
  console.log(`[2] proof generated: header=${fact.headerNumber} index=${fact.txIndex} (${proofMs}ms)`);
  console.log(`[3] BlockProver precompile on CC3 testnet verified this tx: ${fact.verified} (${verifyMs}ms)`);
  console.log(
    `[4] decoded: ${fact.from} -> ${fact.to} value=${Number(fact.valueWei) / 1e18} ETH type=${fact.txType} status=${fact.receiptStatus} (${decodeMs}ms)`,
  );
  console.log(`    factHash: ${fact.factHash}`);

  if (!fact.verified) {
    console.log('\nVERIFY-LIVE: FAIL');
    process.exit(1);
  }
  console.log('\nVERIFY-LIVE: PASS — Attestcoin Protocol integration is live and functional');
}

main().catch((e) => {
  console.error('VERIFY-LIVE: ERROR', e);
  process.exit(2);
});
