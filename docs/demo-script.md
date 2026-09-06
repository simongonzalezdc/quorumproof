# QuorumProof — 2-minute demo script

Setup (before recording): `npm install` done, terminal open, dashboard tab ready
at `http://localhost:8787` (`npm run serve`), browser window 1560×900, dark theme.

---

**[0:00–0:20] Hook — the problem**
> "AI agents are about to move money on-chain — but a single agent is a single
> point of failure with a confident voice. QuorumProof is an agent *fleet*:
> no one agent can move value alone. Every decision comes from a quorum of
> heterogeneous agents deliberating over a fact that Creditcoin itself has
> cryptographically verified — no oracle operator."

**[0:20–0:50] Live Attestcoin proof (`npm run verify-live`)**
> "First, the trust boundary. This is a real Ethereum mainnet transaction —
> 3.6 ETH. The Attestcoin Protocol proves it inside Creditcoin's trust domain:
> proof build, then verification by the BlockProver precompile on CC3 testnet,
> then the on-chain decoder turns the verified bytes into a structured fact.
> All of these are reads — this runs with zero tokens and zero keys."
- Run it; point at `[3] verified: true` and the decoded transfer.

**[0:50–1:30] Fleet deliberation (`npm run demo` or dashboard)**
> "Now the fleet. Three agents, three different mandates: an underwriter that
> demands exact policy fit, a fraud hunter that only cares about transaction
> integrity, and a market analyst that weights partial repayments. Round one is
> a secret ballot — committed before anyone sees anyone's vote. Round two is
> debate: each agent may revise once, under documented rules."
- Dashboard: click `repayment-received` → EXECUTE, 3/3, certificate appears.
- Click `unrelated-inflow` → REJECT, 1/3 — point at Sentinel's
  **"revised"** badge: "sole dissent maintained — its mandate is integrity;
  it discounts confidence and says so on the record. Quorum correctly blocks."

**[1:30–1:50] Auditability**
> "Every ballot is signed with the agent's own secp256k1 control key and bound
> to the Attestcoin fact hash. The QuorumRegistry contract recovers every
> signature on-chain and applies the quorum gate — the decision becomes a
> Creditcoin state fact any lending protocol can consume."

**[1:50–2:00] Close**
> "QuorumProof — auditable autonomous decisions, powered by the Attestcoin
> Protocol. The fleet is the oracle's replacement, and the paper trail is
> the product."

---

Recording notes: capture terminal at 1.1× zoom; on the dashboard, let each
scenario finish before narrating; end frame = certificate panel (EXECUTE).
