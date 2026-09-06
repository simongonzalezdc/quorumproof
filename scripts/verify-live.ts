/**
 * verify-live.ts — live end-to-end proof of Attestcoin Protocol integration.
 *
 * Pipeline (all real network calls, zero tokens, zero private keys):
 *   1. Read the CC3 testnet attested height for a source chain (proof-builder API).
 *   2. Pick (or take via CLI/env) an Ethereum Mainnet transaction below that height.
 *   3. Build an inclusion + continuity proof via the Attestcoin ProofBuilder service.
 *   4. Verify it against the BlockProver precompile (0x...FD2) on CC3 testnet via
 *      an eth_call (staticCall) — real on-chain verification, no gas needed.
 *   5. Decode the verified txBytes with the on-chain EvmV1Decoder library and
 *      print the structured fact the agent fleet would deliberate on.
 *
 * Usage:
 *   npm run verify-live                     # uses DEFAULT_TX
 *   npm run verify-live -- <txHash> [chainKey]
 *   TX_HASH=0x... SOURCE_CHAIN_KEY=3 npm run verify-live
 */
import {
  proofProvider,
  blockProver,
  chainInfo,
  utils,
} from '@gluwa/usc-sdk';
import { Contract, JsonRpcProvider } from 'ethers';
import evmV1DecoderAbi from '@gluwa/usc-sdk/dist/utils/evmV1DecoderAbi.json' with { type: 'json' };

/** CC3 testnet (Creditcoin) — https://docs.attestcoin.org/ chains & environments */
export const CC3_TESTNET_RPC = 'https://rpc.cc3-testnet.creditcoin.network';
export const PROOF_BUILDER_TESTNET = 'https://proof-gen-api.cc3-testnet.creditcoin.network';
/** On-chain EvmV1Decoder library on CC3 testnet */
export const CC3_TESTNET_DECODER = '0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f';
/** chainKey 3 = Ethereum Mainnet as a source chain of the CC3 TESTNET deployment */
export const ETHEREUM_MAINNET_CHAINKEY = 3;

/**
 * Default demo fact: a real Ethereum Mainnet repayment-sized transfer
 * (3.5999664 ETH, block 25914979), mined below the CC3 testnet attested
 * height at authoring time (25919550). Override via CLI/env at any time.
 */
export const DEFAULT_TX = '0x27e55494f572f31c46a79d83de58b8c60cded05185f25637a6f8a710e23d80d7';

export interface LiveProofResult {
  txHash: string;
  chainKey: number;
  headerNumber: unknown;
  attestedHeight: number | undefined;
  proofGenerated: boolean;
  verifiedOnCc3Testnet: boolean;
  decoded?: {
    from: string;
    to: string;
    valueWei: string;
    txType: number;
    status: number | undefined;
  };
  error?: string;
}

export async function runLiveProof(
  txHash: string = DEFAULT_TX,
  chainKey: number = ETHEREUM_MAINNET_CHAINKEY,
): Promise<LiveProofResult> {
  const out: LiveProofResult = {
    txHash,
    chainKey,
    headerNumber: null,
    attestedHeight: undefined,
    proofGenerated: false,
    verifiedOnCc3Testnet: false,
  };

  // 1. Attested height for the source chain (proof-builder REST API)
  const attestedRes = await fetch(`${PROOF_BUILDER_TESTNET}/api/v1/attested-height/${chainKey}`);
  const attestedJson = (await attestedRes.json()) as { attestedHeight?: number };
  out.attestedHeight = attestedJson.attestedHeight;
  console.log(`[1] CC3 testnet attested height for chainKey ${chainKey}: ${out.attestedHeight}`);

  // 2. Generate the inclusion + continuity proof for the tx
  const api = new proofProvider.service.ProofBuilder(chainKey, PROOF_BUILDER_TESTNET);
  const proofResult = await api.getProof(txHash);
  if (!proofResult.success || !proofResult.data) {
    out.error = `proof generation failed: ${String((proofResult as { error?: unknown }).error)}`;
    console.error(`[2] ${out.error}`);
    return out;
  }
  out.proofGenerated = true;
  const proof = proofResult.data;
  out.headerNumber = proof.headerNumber;
  console.log(
    `[2] Proof generated: header=${proof.headerNumber} txBytes=${proof.txBytes.slice(0, 34)}... merkleProof=${proof.merkleProof.length}ch continuity=${proof.continuityProof.length}ch`,
  );

  // 3. Verify against the BlockProver precompile on CC3 testnet (eth_call, free)
  const cc3 = new JsonRpcProvider(CC3_TESTNET_RPC, undefined, { staticNetwork: true });
  const prover = new blockProver.PrecompileBlockProver(cc3);
  out.verifiedOnCc3Testnet = await prover.verifySingle(
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    proof.merkleProof,
    proof.continuityProof,
  );
  console.log(
    `[3] BlockProver(0x...FD2) on CC3 testnet verified this Mainnet tx: ${out.verifiedOnCc3Testnet}`,
  );
  if (!out.verifiedOnCc3Testnet) {
    out.error = 'on-chain verification returned false';
    return out;
  }

  // 4. Decode the verified txBytes via the on-chain EvmV1Decoder library
  try {
    const decoder = new Contract(CC3_TESTNET_DECODER, evmV1DecoderAbi as unknown, cc3);
    const decoded = await utils.decoder.decodeEvmV1Transaction(proof.txBytes, decoder);
    const common = (decoded.data as Record<string, unknown>).common ?? decoded.data;
    const c = common as {
      from?: string; to?: string; value?: bigint;
    };
    const legacy = (decoded.data as Record<string, unknown>).legacy as
      | Record<string, unknown> | undefined;
    const value = (c?.value ?? legacy?.gasPrice ?? 0n) as bigint;
    out.decoded = {
      from: String(c?.from ?? ''),
      to: String(c?.to ?? ''),
      valueWei: value.toString(),
      txType: decoded.type,
      status: undefined,
    };
    console.log(
      `[4] Decoded fact: ${out.decoded.from} -> ${out.decoded.to} value=${Number(value) / 1e18} ETH (type ${decoded.type})`,
    );
  } catch (e) {
    console.warn('[4] decode step skipped:', (e as Error).message);
  }

  return out;
}

const isMain = process.argv[1]?.endsWith('verify-live.ts');
if (isMain) {
  const argTx = process.argv[2] ?? process.env.TX_HASH ?? DEFAULT_TX;
  const argChainKey = Number(process.argv[3] ?? process.env.SOURCE_CHAIN_KEY ?? ETHEREUM_MAINNET_CHAINKEY);
  runLiveProof(argTx, argChainKey)
    .then((r) => {
      const pass = r.verifiedOnCc3Testnet;
      console.log(pass ? '\nVERIFY-LIVE: PASS' : '\nVERIFY-LIVE: FAIL');
      process.exit(pass ? 0 : 1);
    })
    .catch((e) => {
      console.error('VERIFY-LIVE: ERROR', e);
      process.exit(2);
    });
}
