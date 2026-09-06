# BUIDL CTC 2026 Fall — submission checklist (pre-drafted)

Deadline: **2026-09-13 23:59:00 ET** (extended). Winner announcement 2026-09-20.

## Hard requirements (from the official brief)
- [ ] Every team member: no criminal record / no pending cases / not sanctioned / legally permitted (solo dev — verify once)
- [x] Meaningful, functional Attestcoin Protocol integration — live-verified (`npm run verify-live`)
- [x] Working integration code running within the project — `src/attest/gateway.ts` + live demo
- [x] Technical documentation — `docs/attestcoin-integration.md`
- [x] Deployed on a testnet — all live calls hit CC3 testnet; registry deploy faucet-gated (documented)
- [x] Original work created during the hackathon — git history from 2026-09-06
- [ ] GitHub repository URL (public) with README — **CEO: push `main` to a public repo before submitting**
- [ ] Project deck or whitepaper (PDF URL) — content ready (`docs/whitepaper.md`); **CEO: export/print to PDF and host** (any free static host or the repo itself: `docs/whitepaper.pdf`)
- [ ] Prototype demo video URL — script ready (`docs/demo-script.md`); **CEO: record 2-min video, upload (YouTube, unlisted OK), paste URL**
- [ ] Team info: first/last name, email, short bio, role, country of residence + citizenship (Telegram/X/LinkedIn/resume optional)

## DoraHacks BUIDL form fields (from the brief)
- [ ] Project name: QuorumProof
- [ ] Project logo (optional; PNG/SVG) — `design-shots/` can be cropped, or skip (optional field)
- [ ] Project sector: **AI**
- [ ] Project description (short): "An agent fleet that reaches auditable, quorum-gated decisions from Attestcoin-verified cross-chain facts on Creditcoin — no centralized oracle, no single-model authority."
- [ ] Attestcoin Protocol Integration Summary (paste from below)
- [ ] GitHub repo URL
- [ ] Deck/whitepaper PDF URL
- [ ] Demo video URL

### Integration summary (paste-ready)
> QuorumProof uses the Attestcoin Protocol as its trust boundary: the hosted
> ProofBuilder generates an inclusion + continuity proof for a real Ethereum
> mainnet transaction; the SDK's PrecompileBlockProver verifies it against the
> BlockProver precompile (0x…FD2) on CC3 testnet via eth_call; the on-chain
> EvmV1Decoder library turns the verified bytes into a structured fact; and the
> QuorumRegistry contract (CC3-ready) records quorum-gated agent-fleet decisions
> back on-chain with full EIP-191 ballot recovery. ChainInfo precompile keys map
> the source chain. No centralized oracle operator anywhere in the loop.

## Before final submit (operator)
- [ ] `npm run build` green, `npm test` green, `npm audit` clean (documented)
- [ ] `npm run demo` fresh run — EXECUTE + REJECT paths behave
- [ ] README rendered (screenshots load on GitHub)
- [ ] Tag `submission-v1` on the final commit
- [ ] Ask in Discord #buidl-ctc-qna only if something is ambiguous (optional)

## CEO-gated (human-only) steps
1. Create DoraHacks account: dorahacks.io/login → "Welcome! Continue to DoraHacks
   with email, Google, or GitHub login." (email = Get Code OTP, or Google, or GitHub).
2. On https://dorahacks.io/hackathon/buidl-ctc-2026-fall → **Register as Hacker**
   (must be logged in), then **Submit BUIDL** and fill the fields above.
3. Push the repo public; export whitepaper PDF; record/upload demo video.
4. (Optional, unlocks on-chain writes) Join Creditcoin Discord, request CC3 testnet
   tokens from the faucet, set `QUORUMPROOF_REGISTRY_ADDRESS` +
   `QUORUMPROOF_SUBMITTER_KEY`, deploy `contracts/QuorumRegistry.sol`, re-run demo
   in on-chain mode. Never purchase tokens.
5. (Payout) Prize distribution requires the DoraHacks account to be in good
   standing; KYC details were not published on the event page — confirm with the
   organizers via team@creditcoin.org or Discord if ranked.
