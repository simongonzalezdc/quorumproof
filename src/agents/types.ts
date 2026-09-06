/** Shared types for facts, votes, deliberation, and quorum certificates. */

/**
 * A fact that has been cryptographically verified on Creditcoin (CC3) through
 * the Attestcoin Protocol: the source-chain transaction is proven inside the
 * destination chain's trust domain via the BlockProver precompile.
 */
export interface AttestedFact {
  /** Attestcoin source-chain key (registry key, not EVM chainId) */
  chainKey: number;
  /** Source-chain block header the tx is proven in */
  headerNumber: number;
  txIndex: number;
  txHash: string;
  verified: boolean;
  verifiedVia: string;
  /** Decoded fields (from the on-chain EvmV1Decoder library) */
  from: string;
  to: string;
  valueWei: bigint;
  calldata: string;
  txType: number;
  receiptStatus: number | null;
  /** keccak256 binding: chainKey ++ headerNumber ++ txHash ++ verified */
  factHash: string;
  /** CC3 testnet attested height observed when the proof was built */
  attestedHeight?: number;
}

/** The lending policy the fleet deliberates against. */
export interface CreditPolicy {
  /** Expected recipient of the repayment (lender / treasury) */
  lender: string;
  /** Expected repayment amount in wei */
  expectedAmountWei: bigint;
  /** Allowed shortfall, basis points of expectedAmountWei (e.g. 10 = 0.1%) */
  shortfallToleranceBps: number;
  /** Allowed overpayment, basis points (e.g. 500 = 5%) */
  overpayToleranceBps: number;
  /** Minimum plausible repayment; below this the fact is dust */
  minAmountWei: bigint;
}

export type VoteKind = 'APPROVE' | 'DENY' | 'ABSTAIN';

export interface Vote {
  agentId: string;
  agentKind: 'deterministic' | 'llm';
  /** Agent control address (secp256k1 identity used to sign the vote) */
  agentAddress: string;
  vote: VoteKind;
  /** 0..1 self-reported confidence */
  confidence: number;
  reasons: string[];
  round: 1 | 2;
  /** EIP-191 personal_sign signature over voteCommitHash */
  signature?: string;
}

/** What each round-2 voter sees: the aggregate of round 1. */
export interface RoundSummary {
  approvals: number;
  denials: number;
  abstentions: number;
  /** keccak256 over each round-1 vote's commit — the "ballot box" hash */
  ballotBoxHash: string;
}

export type DecisionKind = 'EXECUTE' | 'REJECT';

export interface QuorumCertificate {
  factHash: string;
  policyId: string;
  txLabel: string;
  decision: DecisionKind;
  quorum: { approvals: number; denials: number; abstentions: number; fleetSize: number; required: number };
  votes: Vote[];
  certHash: string;
  createdAt: string;
  chain: 'cc3-testnet';
  /** Where the decision can be enforced on-chain, if configured */
  registry?: string;
}

/** Full observable trace of one fleet assessment — the audit trail. */
export interface DeliberationTrace {
  fact: AttestedFact;
  policy: CreditPolicy;
  policyId: string;
  rounds: { round: 1 | 2; votes: Vote[] }[];
  ballotBoxHash: string;
  certificate: QuorumCertificate;
  timings: { proofMs: number; verifyMs: number; decodeMs: number; deliberateMs: number };
}
