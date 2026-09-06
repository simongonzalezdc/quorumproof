# QuorumProof — whitepaper

*An agent fleet that reaches auditable decisions from Attestcoin-verified cross-chain facts.*
BUIDL CTC 2026 Fall · AI track · September 2026 · v1

---

## 1. Problem

Credit infrastructure is going autonomous. AI agents already draft credit decisions;
they will soon execute them — releasing collateral, marking loans repaid, gating credit
lines. Two blockers stand in the way:

1. **Unverified data.** An agent that reasons about a repayment on Ethereum while sitting
   on Creditcoin must trust a bridge or an oracle operator — centralized parties that can
   lie, lag, or get hacked. The Attestcoin Protocol eliminates exactly this: any source-chain
   transaction can be proven inside Creditcoin's trust domain via on-chain precompiles.
2. **Unaccountable judgment.** A single agent — even a good one — is one prompt injection,
   one buggy model update, one adversarial fact away from moving money wrongly. Finance
   never accepted "trust my sole judgment" from a human clerk; it will not accept it from
   software either. The gap is not better models. The gap is **process**: how a decision is
   reached, and whether it can be audited after the fact.

## 2. Idea

**QuorumProof** treats autonomous decisions the way consensus treats blocks.

A fleet of three heterogeneous agents — an underwriter (`ledger-01`), a fraud hunter
(`sentinel-02`), a market analyst (`meridian-03`), plus an optional fourth LLM analyst —
deliberates over facts that have already passed Attestcoin verification:

- **Round 1 — secret ballot.** Each agent independently votes APPROVE / DENY / ABSTAIN
  with a confidence and reasons. Ballots are committed into a ballot-box hash before
  anyone sees anyone's vote.
- **Round 2 — debate.** The tally is published. Each agent may revise exactly once under
  a *documented* revision rule (e.g., a sole dissenting approver keeps its vote but
  discounts confidence and states the jurisdictional reason on the record).
- **Quorum gate.** EXECUTE requires ≥ N approvals with sufficient mean confidence;
  otherwise REJECT. *Either way* the outcome is a signed **QuorumCertificate**: every
  ballot carries a secp256k1 signature bound (byte-exact, TS↔Solidity) to the Attestcoin
  factHash, policyId, round, and vote.
- **Enforcement.** The certificate is audited locally (signature recovery) and, when
  configured, submitted to `QuorumRegistry` on CC3 — which recovers every ballot on-chain,
  applies the quorum gate a second time in Solidity, and emits `DecisionRecorded`. The
  decision becomes Creditcoin state that any lending protocol can consume.

## 3. Architecture

```
source chain (Ethereum, chainKey 3)
   │  Attestcoin ProofBuilder            (hosted proof service)
   ▼
inclusion + continuity proofs
   │  BlockProver precompile 0x…FD2      (eth_call on CC3 testnet)
   ▼
VERIFIED FACT ──► EvmV1Decoder (eth_call) ──► structured fact + factHash
   │
   ▼
Fleet (ledger / sentinel / meridian [/ llm-analyst])
   round 1 secret ballot → ballot-box hash → debate → round 2
   │
   ▼
QuorumCertificate (6 signed ballots, certHash)
   │
   ├─► local enforcement: signature audit (always)
   └─► QuorumRegistry.submitDecision     (on-chain write, faucet-gated)
          └─► DecisionRecorded event = Creditcoin state fact
```

Trust properties:

- **No unverified data.** `attestTx` throws unless the BlockProver precompile returns true.
  The fleet literally cannot see unverified facts.
- **No single-model authority.** Agents differ in mandate *and* failure mode; the debate
  rules are public, deterministic, and printed into the audit trail.
- **No key ceremonies.** Verification is reads (eth_call); agent keys are ephemeral
  session keys whose signatures are self-certifying in the certificate.
- **Replayability.** factHash + policyId + certHash + 6 recoverable signatures = a
  decision a third party can re-derive end to end.

## 4. What it unlocks

- **Cross-chain repayment verification → autonomous collateral release** (the demo):
  a 3.6 ETH obligation is released when a quorum of agents verifies the actual mainnet
  repayment and blocked for a look-alike inflow.
- The same gate generalizes to DePIN settlement (uptime invoices), RWA income verification
  (creator finance), covenant enforcement — anywhere an autonomous action needs to be
  defensible *after the fact*.

## 5. Evaluation

Live, end-to-end, on public infrastructure (CC3 testnet; mainnet facts via the testnet's
chainKey 3 registry):

- EXECUTE path: real 3.5999664 ETH repayment to the policy lender → 3/3 unanimous,
  quorum met, certificate signed by 3 distinct keys, audit clean.
- REJECT path: legitimate 0.0569 ETH transfer to a third party → Sentinel approves
  (integrity), Ledger and Meridian refuse (policy fit) → 1/3, quorum blocks; Sentinel
  revises with a documented sole-dissent statement; certificate still recorded — a
  *rejected* decision is as auditable as an executed one.
- Tamper test: flipping any signed vote breaks signature recovery (test suite asserts this).
- Full pipeline latency ≈ 2–3 s per assessment (proof ≈ 1 s, verify ≈ 0.3 s, decode ≈ 0.3 s).

## 6. Roadmap

1. **Hackathon → CEIP:** deploy QuorumRegistry to CC3 testnet via the Discord faucet;
   re-run demo in on-chain-write mode.
2. **Fleet-as-a-service:** policy packs per vertical; agents as independent processes
   (today: in-process brains with identical interfaces — the seams for networked agents
   are already drawn).
3. **Heterogeneous model fleet:** route each brain to a different model provider
   (OpenAI-compatible adapter shipped) so no single vendor owns the quorum.
4. **Batch decisions:** `verifyBatch` (max 10 proofs / 1000 blocks per continuity proof)
   for high-volume settlement.

## 7. Limitations (stated plainly)

Default brains are deterministic evaluators — chosen for auditability and a zero-cost,
keyless demo; the LLM adapter exists but is off unless configured. QuorumRegistry is not
yet deployed (faucet-gated); local enforcement is complete and labeled. Ephemeral agent
keys demonstrate signature-bound accountability; a production roster would register
persistent control addresses in `agentControl` (the contract supports this today).
