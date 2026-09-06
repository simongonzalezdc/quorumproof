/**
 * AttestcoinGateway — the trust boundary of QuorumProof.
 *
 * NOTHING enters the fleet's deliberation unless it passed through here:
 *   1. ProofBuilder (hosted Attestcoin proof service) builds a Merkle +
 *      continuity proof for a source-chain transaction.
 *   2. PrecompileBlockProver verifies that proof against the BlockProver
 *      precompile (0x...FD2) ON Creditcoin CC3 via eth_call (staticCall) —
 *      this is real on-chain verification in Creditcoin's trust domain,
 *      requiring no gas and no private key.
 *   3. The verified txBytes are decoded by the ON-CHAIN EvmV1Decoder library
 *      (eth_call again) into the structured fact agents deliberate on.
 *
 * The agent fleet never talks to the source chain. It only ever sees facts
 * that Creditcoin itself has verified — no centralized oracle operator.
 */
import {
  proofProvider,
  blockProver,
  utils,
} from '@gluwa/usc-sdk';
import { Contract } from 'ethers';
import evmV1DecoderAbi from '@gluwa/usc-sdk/dist/utils/evmV1DecoderAbi.json' with { type: 'json' };
import {
  cc3Provider,
  CC3_TESTNET_DECODER,
  PROOF_BUILDER_TESTNET,
} from '../config.js';
import type { AttestedFact, CreditPolicy } from '../agents/types.js';
import { keccak256, AbiCoder, type InterfaceAbi } from 'ethers';

export async function fetchAttestedHeight(chainKey: number): Promise<number | undefined> {
  const res = await fetch(`${PROOF_BUILDER_TESTNET}/api/v1/attested-height/${chainKey}`);
  if (!res.ok) return undefined;
  const json = (await res.json()) as { attestedHeight?: number };
  return json.attestedHeight;
}

const abiCoder = AbiCoder.defaultAbiCoder();

export function computeFactHash(f: {
  chainKey: number;
  headerNumber: number;
  txHash: string;
  verified: boolean;
}): string {
  return keccak256(
    abiCoder.encode(
      ['uint256', 'uint256', 'bytes32', 'bool'],
      [f.chainKey, f.headerNumber, f.txHash, f.verified],
    ),
  );
}

export function computePolicyId(p: CreditPolicy): string {
  return keccak256(
    abiCoder.encode(
      ['address', 'uint256', 'uint32', 'uint32', 'uint256'],
      [p.lender, p.expectedAmountWei, p.shortfallToleranceBps, p.overpayToleranceBps, p.minAmountWei],
    ),
  );
}

export interface ProofOutcome {
  fact: AttestedFact;
  proofMs: number;
  verifyMs: number;
  decodeMs: number;
}

/**
 * Prove a source-chain tx and verify it on CC3. Throws when verification
 * fails — the fleet must never see an unverified fact.
 */
export async function attestTx(
  txHash: string,
  chainKey: number,
): Promise<ProofOutcome> {
  const t0 = Date.now();
  const api = new proofProvider.service.ProofBuilder(chainKey, PROOF_BUILDER_TESTNET);
  const attestedHeight = await fetchAttestedHeight(chainKey);

  const proofResult = await api.getProof(txHash);
  if (!proofResult.success || !proofResult.data) {
    throw new Error(
      `Attestcoin proof generation failed for ${txHash}: ${String((proofResult as { error?: unknown }).error)}`,
    );
  }
  const proof = proofResult.data;
  const proofMs = Date.now() - t0;

  const t1 = Date.now();
  // (Provider + Contract casts bridge the SDK's commonjs ethers types to this project's ESM build.)
  const prover = new blockProver.PrecompileBlockProver(
    cc3Provider() as unknown as ConstructorParameters<typeof blockProver.PrecompileBlockProver>[0],
  );
  const verified = await prover.verifySingle(
    proof.chainKey,
    proof.headerNumber,
    proof.txBytes,
    proof.merkleProof,
    proof.continuityProof,
  );
  if (!verified) {
    throw new Error(
      `BlockProver precompile on CC3 REJECTED the proof for ${txHash} — refusing to deliberate on unverified data`,
    );
  }
  const verifyMs = Date.now() - t1;

  const t2 = Date.now();
  const decoderContract = new Contract(
    CC3_TESTNET_DECODER,
    evmV1DecoderAbi as unknown as InterfaceAbi,
    cc3Provider(),
  ) as unknown as Parameters<typeof utils.decoder.decodeEvmV1Transaction>[1];
  const decoded = await utils.decoder.decodeEvmV1Transaction(proof.txBytes, decoderContract);
  const decodeMs = Date.now() - t2;

  const d = decoded.data as {
    commonTx?: { from?: string; to?: string; value?: bigint; data?: string; toIsNull?: boolean };
    receipt?: { receiptStatus?: number };
  };
  const common = d.commonTx ?? {};
  const value = BigInt(common.value ?? 0);

  const fact: AttestedFact = {
    chainKey: proof.chainKey,
    headerNumber: proof.headerNumber,
    txIndex: proof.txIndex,
    txHash: proof.txHash,
    verified,
    verifiedVia: `BlockProver precompile 0x...FD2 on CC3 testnet (eth_call/staticCall)`,
    from: String(common.from ?? ''),
    to: String(common.to ?? ''),
    valueWei: value,
    calldata: String(common.data ?? '0x'),
    txType: decoded.type,
    receiptStatus:
      d.receipt && d.receipt.receiptStatus !== undefined ? Number(d.receipt.receiptStatus) : null,
    factHash: computeFactHash({
      chainKey: proof.chainKey,
      headerNumber: proof.headerNumber,
      txHash: proof.txHash,
      verified,
    }),
    attestedHeight,
  };
  return { fact, proofMs, verifyMs, decodeMs };
}
