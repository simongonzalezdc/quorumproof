/**
 * Agent brains. Each is a distinct analytic posture over the SAME
 * Attestcoin-verified fact — heterogeneous by design so that quorum is a
 * meaningful check, not three copies of one opinion.
 *
 * Default brains are deterministic analytic evaluators (auditable, offline,
 * zero-cost). An optional LLM brain can be enabled with an OpenAI-compatible
 * endpoint via QUORUMPROOF_LLM_URL / QUORUMPROOF_LLM_MODEL / QUORUMPROOF_LLM_API_KEY;
 * without it the fleet runs fully self-contained.
 */
import type { AttestedFact, CreditPolicy, RoundSummary, Vote, VoteKind } from './types.js';

export interface BrainContext {
  fact: AttestedFact;
  policy: CreditPolicy;
  round: 1 | 2;
  /** Present in round 2: what round 1 produced (secret ballot until then) */
  summary?: RoundSummary;
  /** Present in round 2: this agent's own round-1 ballots (single element) */
  ownRound1?: Vote[];
}

export interface Brain {
  id: string;
  kind: 'deterministic' | 'llm';
  /** One-line charter, shown in the audit trail */
  charter: string;
  evaluate(ctx: BrainContext): Promise<Omit<Vote, 'agentAddress' | 'signature' | 'round'>>;
}

function within(
  v: bigint,
  lo: bigint,
  hi: bigint,
): boolean {
  return v >= lo && v <= hi;
}

/** acceptable repayment window in wei given the policy tolerances */
export function acceptableWindow(p: CreditPolicy): { minWei: bigint; maxWei: bigint } {
  const e = p.expectedAmountWei;
  const min = e - (e * BigInt(p.shortfallToleranceBps)) / 10000n;
  const max = e + (e * BigInt(p.overpayToleranceBps)) / 10000n;
  return { minWei: min < 0n ? 0n : min, maxWei: max };
}

const LEDGER: Brain = {
  id: 'ledger-01',
  kind: 'deterministic',
  charter: 'Conservative underwriter: exact-policy compliance or nothing.',
  async evaluate({ fact, policy, round, ownRound1 }) {
    const reasons: string[] = [];

    if (fact.receiptStatus !== null && fact.receiptStatus !== 1) {
      return { agentId: this.id, agentKind: this.kind, vote: 'DENY', confidence: 0.95, reasons: [`source receipt status ${fact.receiptStatus}: the proven transaction reverted`] };
    }
    if (fact.to.toLowerCase() !== policy.lender.toLowerCase()) {
      return { agentId: this.id, agentKind: this.kind, vote: 'DENY', confidence: 0.9, reasons: [`recipient ${fact.to} is not the policy lender ${policy.lender}`] };
    }
    const { minWei, maxWei } = acceptableWindow(policy);
    if (!within(fact.valueWei, minWei, maxWei)) {
      return {
        agentId: this.id, agentKind: this.kind, vote: 'DENY', confidence: 0.85,
        reasons: [
          `repayment ${Number(fact.valueWei) / 1e18} ETH outside acceptable window [${Number(minWei) / 1e18}, ${Number(maxWei) / 1e18}] ETH`,
        ],
      };
    }
    reasons.push(`recipient matches policy lender`);
    reasons.push(`amount ${Number(fact.valueWei) / 1e18} ETH within tolerated window`);
    reasons.push(`fact proven on CC3 via ${fact.verifiedVia}`);
    return { agentId: this.id, agentKind: this.kind, vote: 'APPROVE', confidence: 0.86, reasons };
  },
};

const SENTINEL: Brain = {
  id: 'sentinel-02',
  kind: 'deterministic',
  charter: 'Fraud & anomaly control: rules on transaction integrity only, never on policy fit.',
  async evaluate({ fact, round, summary, ownRound1 }) {
    const reasons: string[] = [];

    if (fact.receiptStatus === 0) {
      return { agentId: this.id, agentKind: this.kind, vote: 'DENY', confidence: 0.93, reasons: ['proven transaction reverted on source chain'] };
    }
    if (fact.valueWei === 0n) {
      return { agentId: this.id, agentKind: this.kind, vote: 'DENY', confidence: 0.8, reasons: ['zero-value transaction: nothing of economic substance was transferred'] };
    }
    if (fact.from.toLowerCase() === fact.to.toLowerCase()) {
      return { agentId: this.id, agentKind: this.kind, vote: 'DENY', confidence: 0.82, reasons: ['self-transfer: counterparty and beneficiary are the same address'] };
    }
    if (fact.calldata !== '0x' && fact.calldata !== '') {
      reasons.push('calldata present: plain-ETH repayment expected, contract interaction flagged for review');
    }
    reasons.push(`no anomalies: value ${Number(fact.valueWei) / 1e18} ETH, distinct counterparties, status ${fact.receiptStatus ?? 'unknown'}`);

    // Round-2 revision rule (documented): as sole approver facing a fleet that
    // declined, Sentinel maintains its dissent but discounts confidence — its
    // mandate is integrity, and it defers jurisdiction over policy fit.
    if (round === 2 && summary && ownRound1) {
      const mine = ownRound1.find((v) => v.agentId === this.id);
      if (mine?.vote === 'APPROVE' && summary.approvals === 1 && summary.denials >= 2) {
        reasons.push('sole dissent maintained: mandate is transaction integrity; policy fit belongs to ledger/meridian');
        return { agentId: this.id, agentKind: this.kind, vote: 'APPROVE', confidence: 0.66, reasons };
      }
    }
    return { agentId: this.id, agentKind: this.kind, vote: 'APPROVE', confidence: 0.74, reasons };
  },
};

const MERIDIAN: Brain = {
  id: 'meridian-03',
  kind: 'deterministic',
  charter: 'Market & timing analyst: partial repayments get weighted, not zeroed.',
  async evaluate({ fact, policy, round, summary, ownRound1 }) {
    const reasons: string[] = [];
    const { minWei } = acceptableWindow(policy);

    if (fact.receiptStatus !== null && fact.receiptStatus !== 1) {
      return { agentId: this.id, agentKind: this.kind, vote: 'ABSTAIN', confidence: 0.5, reasons: ['reverted tx — outside my mandate, deferring to ledger/sentinel'] };
    }
    if (fact.valueWei >= minWei && fact.to.toLowerCase() === policy.lender.toLowerCase()) {
      const ratio = Number(fact.valueWei) / Number(policy.expectedAmountWei);
      const confidence = Math.max(0.5, Math.min(0.9, 0.55 + 0.35 * Math.min(1, ratio)));
      reasons.push(`recipient correct; coverage ratio ${(ratio * 100).toFixed(2)}% of expected`);
      reasons.push(`attestation depth: source block ${fact.headerNumber} vs attested height ${fact.attestedHeight ?? 'n/a'}`);
      return { agentId: this.id, agentKind: this.kind, vote: 'APPROVE', confidence, reasons };
    }
    if (fact.valueWei >= policy.minAmountWei) {
      reasons.push('material payment observed but policy match incomplete — recommend restructuring, not execution');
      // Round-2 revision rule (documented): a sole DENY against a unified
      // approving fleet softens to ABSTAIN — concede the floor, not the point.
      if (round === 2 && summary && ownRound1) {
        const mine = ownRound1.find((v) => v.agentId === this.id);
        if (mine?.vote === 'DENY' && summary.approvals >= 2) {
          reasons.push('conceding to fleet majority: objection recorded as abstention');
          return { agentId: this.id, agentKind: this.kind, vote: 'ABSTAIN', confidence: 0.6, reasons };
        }
      }
      return { agentId: this.id, agentKind: this.kind, vote: 'DENY', confidence: 0.7, reasons };
    }
    reasons.push('payment below dust floor — no economic basis to execute');
    return { agentId: this.id, agentKind: this.kind, vote: 'DENY', confidence: 0.7, reasons };
  },
};

export const DETERMINISTIC_FLEET: Brain[] = [LEDGER, SENTINEL, MERIDIAN];

/**
 * Optional LLM analyst (round-trip to any OpenAI-compatible endpoint).
 * Exported so the fleet can swap MERIDIAN for it when configured.
 */
export function makeLlmBrain(opts: {
  url: string;
  model: string;
  apiKey: string;
}): Brain {
  return {
    id: 'llm-analyst-04',
    kind: 'llm',
    charter: 'LLM analyst: reasons over the verified fact and policy in natural language.',
    async evaluate({ fact, policy }) {
      const prompt = [
        'You are an autonomous credit analyst. You are given a CRYPTOGRAPHICALLY VERIFIED',
        'cross-chain fact (attested on Creditcoin via the Attestcoin Protocol) and a lending policy.',
        'Return STRICT JSON: {"vote":"APPROVE|DENY|ABSTAIN","confidence":0..1,"reasons":["..."]}',
        '',
        `FACT: ${JSON.stringify({
          txHash: fact.txHash,
          from: fact.from,
          to: fact.to,
          valueEth: Number(fact.valueWei) / 1e18,
          receiptStatus: fact.receiptStatus,
          sourceBlock: fact.headerNumber,
          verified: fact.verified,
        })}`,
        `POLICY: ${JSON.stringify({
          lender: policy.lender,
          expectedEth: Number(policy.expectedAmountWei) / 1e18,
          shortfallToleranceBps: policy.shortfallToleranceBps,
          overpayToleranceBps: policy.overpayToleranceBps,
          minEth: Number(policy.minAmountWei) / 1e18,
        })}`,
      ].join('\n');
      const res = await fetch(`${opts.url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({
          model: opts.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
        }),
      });
      if (!res.ok) throw new Error(`LLM endpoint ${res.status}`);
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? '';
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('LLM returned no JSON object');
      const parsed = JSON.parse(match[0]) as {
        vote?: string; confidence?: number; reasons?: string[];
      };
      const vote = (['APPROVE', 'DENY', 'ABSTAIN'] as VoteKind[]).includes(parsed.vote as VoteKind)
        ? (parsed.vote as VoteKind)
        : 'ABSTAIN';
      return {
        agentId: this.id,
        agentKind: this.kind,
        vote,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
        reasons: (parsed.reasons ?? []).slice(0, 5).map(String),
      };
    },
  };
}
