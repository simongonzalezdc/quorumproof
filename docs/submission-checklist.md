# BUIDL CTC 2026 Fall — submission checklist (FINAL, 2026-09-09)

Deadline: **2026-09-13 23:59:00 ET** (extended). Winner announcement 2026-09-20.

## State (read first)
- Final design = HEAD `8ba592e` + whitepaper artifact commit `95997ba` (The Chamber + midnight-ledger dark per DESIGN-SYSTEM.md incl. 5df3b17 amendment). Final gate **SHIP 14/14** — org-hq `docs/cfo-corpus/gates/final-quorumproof-0908.md`, evidence in `evidence-final-0908/quorumproof/` (both themes, judging frames, contrast tables, keyboard/evidence probes).
- **Whitepaper PDF: DONE and committed** → `docs/whitepaper.pdf` (A4, 3pp, generated from `docs/whitepaper.md`; ledger-styled serif+mono). The form's "PDF URL" = the repo raw link once the repo is public:
  `https://github.com/<owner>/<repo>/raw/main/docs/whitepaper.pdf`
- **Demo video:** 2-min script locked (`docs/demo-script.md`). Production reassigned by CEO order to the **kinocut + Hyperframes lane** (screen-recorded live demo, both themes). **v2.1 DONE, gate PASS:** kyanite-chrome overlay pass (QP-VIDEO-v2.1) lifted the kinocut gate **67.4 → 80.2 — all 5 gating checks passed** (`assert_quality` min-score-80 PASS; receipt: `docs/demo-video-receipt.json` v21_block). Still **silent** (narration lane not provisioned). Upload (YouTube unlisted) is a CEO act; the URL slots into the form field below. This repo's `docs/demo-video.*` is owned by that lane.
- Nothing is pushed, uploaded, or submitted until the CEO says go.

## Hard requirements (from the official brief)
- [ ] Every team member: no criminal record / no pending cases / not sanctioned / legally permitted (solo dev — verify once)
- [x] Meaningful, functional Attestcoin Protocol integration — live-verified (`npm run verify-live`)
- [x] Working integration code running within the project — `src/attest/gateway.ts` + live demo
- [x] Technical documentation — `docs/attestcoin-integration.md`
- [x] Deployed on a testnet — all live calls hit CC3 testnet; registry deploy faucet-gated (documented)
- [x] Original work created during the hackathon — git history from 2026-09-06
- [ ] GitHub repository URL (public) with README — content final; **CEO: push `main`** (includes `docs/whitepaper.pdf`)
- [ ] Project deck or whitepaper (PDF URL) — **`docs/whitepaper.pdf` committed (95997ba)**; URL = repo raw link after push
- [ ] Prototype demo video URL — script + build final; kinocut lane produces, CEO uploads (YouTube unlisted OK), URL pasted here: `________`
- [ ] Team info: first/last name, email, short bio, role, country of residence + citizenship (Telegram/X/LinkedIn/resume optional)

## DoraHacks BUIDL form fields (final copy)
- [ ] Project name: **QuorumProof**
- [ ] Project logo (optional; PNG/SVG) — `design-shots/` can be cropped, or skip (optional field)
- [ ] Project sector: **AI**
- [ ] Project description (short): "An agent fleet that reaches auditable, quorum-gated decisions from Attestcoin-verified cross-chain facts on Creditcoin — no centralized oracle, no single-model authority."
- [ ] Attestcoin Protocol Integration Summary (paste from below)
- [ ] GitHub repo URL: `https://github.com/<owner>/<repo>` (after CEO push)
- [ ] Deck/whitepaper PDF URL: `https://github.com/<owner>/<repo>/raw/main/docs/whitepaper.pdf` (after CEO push)
- [ ] Demo video URL: (kinocut output, after CEO upload)

### Integration summary (paste-ready)
> QuorumProof uses the Attestcoin Protocol as its trust boundary: the hosted
> ProofBuilder generates an inclusion + continuity proof for a real Ethereum
> mainnet transaction; the SDK's PrecompileBlockProver verifies it against the
> BlockProver precompile (0x…FD2) on CC3 testnet via eth_call; the on-chain
> EvmV1Decoder library turns the verified bytes into a structured fact; and the
> QuorumRegistry contract (CC3-ready) records quorum-gated agent-fleet decisions
> back on-chain with full EIP-191 ballot recovery. ChainInfo precompile keys map
> the source chain. No centralized oracle operator anywhere in the loop.

## Before final submit (operator — done/verified where marked)
- [x] `npm run build` green, `npm test` green (14/14 gate; offline suite 10 passing), `npm audit` documented
- [x] `npm run demo` fresh run — EXECUTE + REJECT paths behave (re-verified at gate, 2026-09-09)
- [x] Dashboard renders both themes console-zero at 1440×900 + 390×844 (gate evidence)
- [ ] README rendered (screenshots load on GitHub) — verify after push
- [ ] Tag `submission-v1` on the final commit (after kinocut video lands, before submit)
- [ ] Ask in Discord #buidl-ctc-qna only if something is ambiguous (optional)

## CEO ACT LIST — exact, in order (≤5)
1. **Say go on the repo push** → `git push origin main` to the public GitHub repo (main @ `95997ba` or later), then tag `submission-v1`.
2. **Upload the kinocut demo video** (YouTube unlisted) once the kinocut lane delivers it; paste the URL into the form field.
3. **DoraHacks account + registration:** dorahacks.io/login (email OTP / Google / GitHub) → on https://dorahacks.io/hackathon/buidl-ctc-2026-fall click **Register as Hacker**.
4. **Submit BUIDL** on the same page — paste the fields above (all copy final in this checklist).
5. *(Optional, only if ranked/payout)* Confirm team KYC requirements with organizers via team@creditcoin.org or Discord; *(optional, unlocks on-chain writes)* Creditcoin Discord faucet → set `QUORUMPROOF_REGISTRY_ADDRESS` + `QUORUMPROOF_SUBMITTER_KEY`, deploy `contracts/QuorumRegistry.sol`, re-run demo on-chain. Never purchase tokens.
