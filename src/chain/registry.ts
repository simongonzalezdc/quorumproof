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
 *    Membership and threshold are enforced from committed on-chain state, so
 *    before submitting this module syncs the roster (registerAgent) and the
 *    policy threshold (registerPolicy) — both owner-only, meaning the
 *    submitter key must be the registry owner/deployer.
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
  'event AgentRegistered(bytes32 indexed agentId, address indexed control)',
  'event PolicyRegistered(bytes32 indexed policyId, uint8 requiredApprovals)',
  // revert reasons (decoded client-side)
  'error NotRegistered(bytes32 agentId)',
  'error PolicyNotRegistered(bytes32 policyId)',
  'error BadThreshold()',
  // membership, threshold and the outcome are ALL enforced on-chain:
  // there is no decision / signers[] / requiredApprovals parameter to pass.
  'function submitDecision(bytes32 factHash, bytes32 policyId, bytes32[] agentIds, bytes32[] r, bytes32[] s, uint8[] v, uint8[] votes) returns (bytes32)',
  'function decisions(bytes32) view returns (bytes32 certHash, uint8 decision, uint8 approvals, uint8 fleetSize, uint64 timestamp)',
  'function registerAgent(bytes32 agentId, address control)',
  'function registerPolicy(bytes32 policyId, uint8 requiredApprovals)',
  'function agentControl(bytes32) view returns (address)',
  'function policyQuorum(bytes32) view returns (uint8)',
  // canonical digest helpers — byte-identical to src/agents/certificate.ts
  // (cross-language parity enforced by test/parity.test.ts)
  'function ballotDigestOf(bytes32 factHash, bytes32 policyId, uint8 round, bytes32 agentId, uint8 vote) view returns (bytes32)',
  'function certificateHashOf(bytes32 factHash, bytes32 policyId, uint8 decision, uint8 approvals, uint8 fleetSize) view returns (bytes32)',
];

/**
 * Assemble the certificate submission payload for QuorumRegistry.submitDecision.
 * Signatures are EIP-191 personal_sign over the canonical ballot digest —
 * exactly what Fleet.collectSigned produced, so no re-signing is needed.
 *
 * Note what is deliberately ABSENT: no `decision`, no `signers[]`, no
 * `requiredApprovals`. The contract derives the expected signer from the
 * on-chain roster (agentControl), the threshold from the committed policy
 * (policyQuorum), and the recorded outcome from approvals >= threshold.
 */
export function encodeSubmission(trace: DeliberationTrace): {
  factHash: string;
  policyId: string;
  agentIds: string[];
  r: string[];
  s: string[];
  v: number[];
  votes: number[];
} {
  const finalVotes = trace.certificate.votes.filter((v) => v.round === 2);
  const rs = finalVotes.map((v) => splitSignature(v.signature ?? ''));
  return {
    factHash: trace.certificate.factHash,
    policyId: trace.certificate.policyId,
    agentIds: finalVotes.map((v) => agentIdHash(v.agentId)),
    r: rs.map((x) => x.r),
    s: rs.map((x) => x.s),
    v: rs.map((x) => x.v),
    votes: finalVotes.map((v) => VOTE_BYTE[v.vote]),
  };
}

/**
 * The fleet roster a submission depends on: round-2 voters' agentId => control
 * address. Agent keys are ephemeral per fleet spawn, so before submitting, the
 * registry's roster must be synced to THIS run's control addresses (see
 * syncRosterAndPolicy). Making keys persistent/derivable is tracked separately
 * and would let the roster be registered once instead of per run.
 */
export function rosterOf(trace: DeliberationTrace): { agentId: string; control: string }[] {
  return trace.certificate.votes
    .filter((v) => v.round === 2)
    .map((v) => ({ agentId: agentIdHash(v.agentId), control: v.agentAddress }));
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

  // Sync the on-chain state the contract enforces from: the roster (register
  // this run's agent control addresses — keys are ephemeral per spawn) and the
  // policy threshold (register the local quorum config once; if a threshold is
  // already committed, the COMMITTED value governs and is never lowered here).
  let sync: Awaited<ReturnType<typeof syncRosterAndPolicy>>;
  try {
    sync = await syncRosterAndPolicy(registry, trace, sub.policyId);
  } catch (e) {
    return {
      mode: 'on-chain',
      verified: false,
      failures: [...failures, `roster/policy sync failed: ${(e as Error).message}`],
      note:
        'refusing to submit: roster/policy sync failed (registerAgent/registerPolicy are owner-only — QUORUMPROOF_SUBMITTER_KEY must be the registry owner)',
    };
  }

  const tx = await registry.getFunction('submitDecision')(
    sub.factHash,
    sub.policyId,
    sub.agentIds,
    sub.r,
    sub.s,
    sub.v,
    sub.votes,
  );
  const receipt = await tx.wait();

  // The on-chain decision is the authoritative one — read it back from the
  // DecisionRecorded event rather than trusting the local claim.
  let onChain: { decision: number; approvals: number; fleetSize: number } | undefined;
  for (const log of receipt?.logs ?? []) {
    try {
      const ev = registry.interface.parseLog({ data: log.data, topics: [...log.topics] });
      if (ev?.name === 'DecisionRecorded') {
        onChain = {
          decision: Number(ev.args.decision),
          approvals: Number(ev.args.approvals),
          fleetSize: Number(ev.args.fleetSize),
        };
      }
    } catch {
      // a log not emitted by the registry — ignore
    }
  }
  const claimed = trace.certificate.decision === 'EXECUTE' ? 1 : 0;
  const divergence =
    onChain && onChain.decision !== claimed
      ? ` — on-chain outcome (${onChain.decision === 1 ? 'EXECUTE' : 'REJECT'}) OVERRULES the local claim (${trace.certificate.decision}); the committed threshold governs`
      : '';
  const syncNote = sync.actions.length > 0 ? `; sync: ${sync.actions.join(', ')}` : '';
  return {
    mode: 'on-chain',
    verified: audit.ok && (receipt?.status ?? 1) === 1,
    failures,
    txHash: receipt?.hash ?? tx.hash,
    note: onChain
      ? `certificate recorded by QuorumRegistry at ${REGISTRY_ADDRESS} on CC3 testnet: ${onChain.decision === 1 ? 'EXECUTE' : 'REJECT'} (${onChain.approvals}/${onChain.fleetSize} approvals, committed threshold ${sync.threshold})${divergence}${syncNote}`
      : `certificate submitted to QuorumRegistry at ${REGISTRY_ADDRESS} on CC3 testnet${syncNote}`,
  };
}

/**
 * Bring the registry's roster and policy threshold in line with this run
 * before submitting. Every action here is owner-only on-chain, so the
 * QUORUMPROOF_SUBMITTER_KEY must be the registry owner (the deployer).
 *  - registerAgent: writes agentId => this run's control address when the
 *    committed entry differs (ephemeral keys mean a fresh roster per run).
 *  - registerPolicy: commits the local quorum threshold ONLY if no threshold
 *    is committed for the policy yet. An existing commitment is returned and
 *    never overwritten — a submitter must not be able to move the threshold
 *    it will be judged against (neither down nor up).
 */
async function syncRosterAndPolicy(
  registry: Contract,
  trace: DeliberationTrace,
  policyId: string,
): Promise<{ actions: string[]; threshold: number }> {
  const actions: string[] = [];
  for (const entry of rosterOf(trace)) {
    const committedAddr = (await registry.getFunction('agentControl')(entry.agentId)) as string;
    if (committedAddr.toLowerCase() !== entry.control.toLowerCase()) {
      await (await registry.getFunction('registerAgent')(entry.agentId, entry.control)).wait();
      actions.push(`registerAgent ${entry.agentId.slice(0, 10)}…`);
    }
  }
  let threshold = Number((await registry.getFunction('policyQuorum')(policyId)) as bigint);
  if (threshold === 0) {
    const required = trace.certificate.quorum.required;
    if (required < 1) throw new Error(`local quorum config has requiredApprovals=${required}; on-chain thresholds must be >= 1`);
    await (await registry.getFunction('registerPolicy')(policyId, required)).wait();
    threshold = required;
    actions.push(`registerPolicy threshold=${required}`);
  }
  return { actions, threshold };
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
