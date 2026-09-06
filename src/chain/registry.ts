/**
 * Chain layer: quorum certificates become on-chain-enforceable decisions.
 *
 * Two modes:
 *  - LOCAL (default): certificate is assembled and every ballot signature is
 *    recovered/verified locally (auditCertificateSignatures). No gas needed.
 *  - ON-CHAIN (opt-in): if QUORUMPROOF_REGISTRY_ADDRESS points at a deployed
 *    QuorumRegistry on CC3 testnet, the certificate is submitted in a real
 *    transaction (requires a funded testnet key via QUORUMPROOF_SUBMITTER_KEY).
 *    The contract recovers every signer, checks the quorum threshold, and
 *    emits DecisionRecorded — the decision becomes a Creditcoin state fact.
 *
 * The precompile verification in src/attest/gateway.ts is ALREADY an on-chain
 * step (eth_call to the BlockProver) and needs no keys; the registry adds an
 * on-chain WRITE for deployments that have faucet tokens.
 */
import { Contract, Wallet, BaseWallet } from 'ethers';
import type { DeliberationTrace, QuorumCertificate } from '../agents/types.js';
import { auditCertificateSignatures } from '../agents/fleet.js';
import { agentIdHash, splitSignature, voteDigest, VOTE_BYTE } from '../agents/certificate.js';
import { cc3Provider, REGISTRY_ADDRESS } from '../config.js';

export const QUORUM_REGISTRY_ABI = [
  'event DecisionRecorded(bytes32 indexed certHash, bytes32 indexed factHash, bytes32 policyId, uint8 decision, uint8 approvals, uint8 fleetSize)',
  'function submitDecision(bytes32 factHash, bytes32 policyId, uint8 decision, bytes32[] agentIds, address[] signers, bytes32[] r, bytes32[] s, uint8[] v, uint8[] votes, uint8 requiredApprovals) returns (bytes32)',
  'function decisions(bytes32) view returns (bytes32 certHash, uint8 decision, uint8 approvals, uint8 fleetSize, uint64 timestamp)',
  'function registerAgent(bytes32 agentId, address control) external',
];

/**
 * Assemble the certificate submission payload for QuorumRegistry.submitDecision.
 * Signatures are EIP-191 personal_sign over the canonical ballot digest —
 * exactly what Fleet.collectSigned produced, so no re-signing is needed.
 */
export function encodeSubmission(trace: DeliberationTrace): {
  factHash: string;
  policyId: string;
  decision: number;
  agentIds: string[];
  signers: string[];
  r: string[];
  s: string[];
  v: number[];
  votes: number[];
  requiredApprovals: number;
} {
  const finalVotes = trace.certificate.votes.filter((v) => v.round === 2);
  const rs = finalVotes.map((v) => splitSignature(v.signature ?? ''));
  return {
    factHash: trace.certificate.factHash,
    policyId: trace.certificate.policyId,
    decision: trace.certificate.decision === 'EXECUTE' ? 1 : 0,
    agentIds: finalVotes.map((v) => agentIdHash(v.agentId)),
    signers: finalVotes.map((v) => v.agentAddress),
    r: rs.map((x) => x.r),
    s: rs.map((x) => x.s),
    v: rs.map((x) => x.v),
    votes: finalVotes.map((v) => VOTE_BYTE[v.vote]),
    requiredApprovals: trace.certificate.quorum.required,
  };
}

export interface SubmissionResult {
  mode: 'local' | 'on-chain';
  verified: boolean;
  failures: string[];
  txHash?: string;
  note: string;
}

/**
 * Enforce the certificate. Local mode always runs (and is what the default
 * demo uses); on-chain mode only when configured with a deployed registry.
 */
export async function enforce(trace: DeliberationTrace): Promise<SubmissionResult> {
  const audit = auditCertificateSignatures(trace);
  const failures = audit.failures;

  if (!REGISTRY_ADDRESS) {
    return {
      mode: 'local',
      verified: audit.ok,
      failures,
      note:
        'local enforcement: all ballots signature-verified; set QUORUMPROOF_REGISTRY_ADDRESS to submit the certificate on-chain (needs CC3 testnet gas from the faucet)',
    };
  }

  if (!audit.ok) {
    return {
      mode: 'on-chain',
      verified: false,
      failures,
      note: 'refusing to submit: local signature audit failed',
    };
  }

  const key = process.env.QUORUMPROOF_SUBMITTER_KEY;
  if (!key) {
    return {
      mode: 'on-chain',
      verified: audit.ok,
      failures,
      note: 'registry configured but QUORUMPROOF_SUBMITTER_KEY missing — cannot sign the submission tx',
    };
  }

  const submitter: BaseWallet = new Wallet(key, cc3Provider());
  const registry = new Contract(REGISTRY_ADDRESS, QUORUM_REGISTRY_ABI, submitter);
  const sub = encodeSubmission(trace);
  const tx = await registry.submitDecision(
    sub.factHash,
    sub.policyId,
    sub.decision,
    sub.agentIds,
    sub.signers,
    sub.r,
    sub.s,
    sub.v,
    sub.votes,
    sub.requiredApprovals,
  );
  const receipt = await tx.wait();
  return {
    mode: 'on-chain',
    verified: audit.ok,
    failures,
    txHash: receipt?.hash ?? tx.hash,
    note: `certificate submitted to QuorumRegistry at ${REGISTRY_ADDRESS} on CC3 testnet`,
  };
}

/** Pretty certificate for logs/UI. */
export function renderCertificate(cert: QuorumCertificate): string {
  const lines = [
    `  decision      : ${cert.decision}  (${cert.quorum.approvals}/${cert.quorum.fleetSize} approvals, ${cert.quorum.required} required)`,
    `  factHash      : ${cert.factHash}`,
    `  policyId      : ${cert.policyId}`,
    `  certHash      : ${cert.certHash}`,
    `  votes         :`,
    ...cert.votes
      .filter((v) => v.round === 2)
      .map(
        (v) =>
          `    [r${v.round}] ${v.agentId.padEnd(14)} ${v.vote.padEnd(7)} conf=${v.confidence.toFixed(2)}  ${v.agentAddress}  sig=${(v.signature ?? '').slice(0, 14)}…`,
      ),
  ];
  return lines.join('\n');
}
