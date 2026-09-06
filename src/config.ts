/**
 * Central configuration. Everything here is public infrastructure — no secrets.
 * Values follow https://docs.attestcoin.org (Attestcoin Protocol — Chains & Environments).
 */
import { JsonRpcProvider } from 'ethers';

/** CC3 (Creditcoin) testnet EVM RPC */
export const CC3_TESTNET_RPC = 'https://rpc.cc3-testnet.creditcoin.network';
/** CC3 testnet chainId (0x18e8f) */
export const CC3_TESTNET_CHAIN_ID = 102031;
/** Hosted Attestcoin Proof Builder (testnet; swagger available here) */
export const PROOF_BUILDER_TESTNET = 'https://proof-gen-api.cc3-testnet.creditcoin.network';
/** BlockProver precompile on CC3 (same address on mainnet & testnet) */
export const BLOCK_PROVER_PRECOMPILE = '0x0000000000000000000000000000000000000FD2';
/** ChainInfo precompile on CC3 */
export const CHAIN_INFO_PRECOMPILE = '0x0000000000000000000000000000000000000FD3';
/** On-chain EvmV1Decoder library on CC3 testnet */
export const CC3_TESTNET_DECODER = '0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f';

/**
 * Source-chain keys in the CC3 TESTNET Attestcoin registry (NOT EVM chainIds):
 *   chainKey 1 -> Ethereum Sepolia
 *   chainKey 3 -> Ethereum Mainnet  (yes: testnet can attest real mainnet facts)
 */
export const ETHEREUM_MAINNET_CHAINKEY = 3;
export const ETHEREUM_SEPOLIA_CHAINKEY = 1;

/** Real mainnet txs used by the demo (mined below the CC3 testnet attested height). */
export const DEMO_TX_APPROVE = '0x27e55494f572f31c46a79d83de58b8c60cded05185f25637a6f8a710e23d80d7'; // 3.5999664 ETH
export const DEMO_TX_REJECT = '0x890dbaaf163716cc1877ec0c69772d57f8cbfebafb151edaca050ef5654fc744'; // 0.0569 ETH

/** Optional LLM brain: any OpenAI-compatible endpoint. Unset by default => deterministic fleet. */
export const LLM_URL = process.env.QUORUMPROOF_LLM_URL ?? '';
export const LLM_MODEL = process.env.QUORUMPROOF_LLM_MODEL ?? '';
export const LLM_API_KEY = process.env.QUORUMPROOF_LLM_API_KEY ?? '';

/** Optional: address of a deployed QuorumRegistry on CC3 testnet. Unset => local certificate. */
export const REGISTRY_ADDRESS = process.env.QUORUMPROOF_REGISTRY_ADDRESS ?? '';

let _cc3: JsonRpcProvider | null = null;
export function cc3Provider(): JsonRpcProvider {
  if (!_cc3) _cc3 = new JsonRpcProvider(CC3_TESTNET_RPC, undefined, { staticNetwork: true });
  return _cc3;
}

let _mainnet: JsonRpcProvider | null = null;
/** Fallback public mainnet RPC used only to *discover* candidate txs, never to trust them. */
export const PUBLIC_MAINNET_RPCS = [
  'https://eth.drpc.org',
  'https://rpc.flashbots.net',
  'https://eth.meowrpc.com',
];
export function mainnetProvider(): JsonRpcProvider {
  if (!_mainnet) _mainnet = new JsonRpcProvider(PUBLIC_MAINNET_RPCS[0]!, undefined, { staticNetwork: true });
  return _mainnet;
}
