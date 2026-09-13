# QuorumProof — 2-minute demo script (v2.6, 2026-09-13 — EXECUTE weight-line treatment (own sentence + air, mirrors REJECT) per CEO ear note; facts frozen)

Setup (unchanged): terminal open, dashboard at localhost, dark theme. Narration recorded via canonical Simon clone; blank lines = paragraph beats (720ms), em dashes = connective clauses (never end one on a lone period before a payoff — anti-uptalk doctrine).

---

**[0:00–0:20] Hook — the problem**

Here's the problem — AI agents are about to move money on-chain, and one agent is just one confident voice holding the keys.

I'm not okay with that.

QuorumProof is a fleet — no single agent can move value alone. Every decision needs a quorum, and the fact they argue over is verified by Creditcoin itself. Not an oracle operator in the middle — the chain itself.

**[0:20–0:50] Live Attestcoin proof (`npm run verify-live`)**

Look at this — it's a real run, not a mock. That's a real Ethereum mainnet transaction, 3.6 ETH. Attestcoin proves it inside Creditcoin's own trust domain — build the proof, verify it with the BlockProver precompile on CC3 testnet, decode it on-chain into a structured fact.

And it's all reads — zero tokens, zero keys. I don't need to spend anything to prove a fact.

- Run it; point at `[3] verified: true` and the decoded transfer.

**[0:50–1:30] Fleet deliberation (`npm run demo` / dashboard)**

Now the fleet. Three agents, three mandates — not three copies of the same model. The underwriter wants exact policy fit. The fraud hunter asks one question: is this transaction real? The market analyst reads partial repayments.

Round one is a secret ballot — everyone commits before anyone sees a vote. Round two is debate, and each agent can revise once.

Watch the repayment case — three out of three.

Execute.

The certificate's sealed, every ballot signature verified.

Now an unrelated inflow — watch the split. The fraud hunter says yes — the transaction's real, its integrity check passes. The other two say no on policy: this isn't a repayment.

One out of three. REJECT.

The quorum blocks it, and the sole dissent is right there on the record — that's the product working.

- Dashboard: click `repayment-received` → EXECUTE 3/3, certificate appears. Click `unrelated-inflow` → REJECT 1/3 — point at the **"revised"** badge on the dissenter.

**[1:30–1:50] Auditability**

Every ballot's signed with the agent's own secp256k1 key and bound to the Attestcoin fact hash.

On-chain, the QuorumRegistry contract recovers every signature and applies the quorum gate — two of three.

Deploy it, and the decision becomes a Creditcoin fact — one any lending protocol can consume.

**[1:50–2:00] Close**

QuorumProof — auditable autonomous decisions on the Attestcoin Protocol.

The fleet replaces the oracle — and the paper trail is the product.

---

Recording notes (unchanged): capture terminal at 1.1× zoom; let each scenario finish before narrating; end frame = certificate panel (EXECUTE).
