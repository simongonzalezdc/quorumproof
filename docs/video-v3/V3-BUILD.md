# QP-VIDEO-v3 — BUILD RECORD

Lane: QP-VIDEO-v3 (org PRODUCT lane) · 2026-09-12 · master: `docs/video-v3/demo-video-v3.mp4`
Spec source: CEO verbatim directive (Hyperframes-native, reuse the app's real HTML, authored GSAP motion only, chrome-only Kyanite) + Astra visual-review rulings (gpt-6, `/tmp/qp-astra-review-output.md` L5644–5862, binding) + v1.3 QA gate order.

## 1. What this is

A 119.1s, 1920×1080\@30fps Hyperframes composition that puts **QuorumProof's own designed
dashboard on the canvas as live HTML** — the app's real components (masthead, clerk's desk,
Chamber: exhibit → ballots → quorum → sealed certificate, docket, fact & proof detail, raw
bytes) ported verbatim from `~/workspaces/buidl-ctc/src/web/index.html` + the render
functions of `src/web/app.js`, at a video type scale (app px × ~1.4) so essential evidence
reads at 960×540 playback. Case data is **not transcribed by hand**: the builder
(`../build-pkg.mjs`) reads `src/web/seed-trace.json` (the app's own deterministic seed) and
emits `hyperframes/index.html`.

The **only captured content** is the real terminal `npm run verify-live` run (CEO-allowed
exception), full-bleed as a content segment — see §4.

Zero screenshots-in-boxes. Zero nested presentation surfaces. One `#master` coordinate grid;
views are absolute siblings keyed by `data-start`/`data-duration` (Hyperframes runtime).

## 2. Scene / timing map (narration clock re-verified)

Narration: `docs/audio/program-mix-48k-final.wav` (119.100s — identical to video; no
stretching, no padding needed). Onset re-verify (silencedetect −38dB/0.45s on
`narration-gained.wav`): **0.93 / 23.08 / 49.32 / 92.63 / 111.07** vs spec 0.8/23.0/49.2/92.6/111.0 ✓.

| # | Timeline | Frames | Scene | Content |
|---|----------|--------|-------|---------|
| 1 | 0 – 10.1 | 0–303 | Hook | QP serif thesis lines land on narration beats (0.95/4.3/8.35), exit 9.6 |
| 2 | 10.1 – 21.5 | 303–645 | Dashboard at rest | Real app masthead + clerk + Chamber "awaiting proceeding" (app boot state) |
| 3 | 21.5 – 49.35 | 645–1480 | Live proof | Real `verify-live` capture full-bleed (recapture, §4); PASS hold to section end |
| 4 | 49.35 – 56.0 | 1480–1680 | The fleet | App §3 fleet roster (agentId, kind, address, charter) |
| 5 | 56.0 – 68.4 | 1680–2052 | QP-001 repayment-received | Exhibit stamp → proof checks → Round I (secret) → Round II → tally count-up 1→2→3 → verdict stamp EXECUTE → certificate issues |
| 6 | 68.4 – 72.3 | 2052–2169 | Certificate close-up | cert-doc component becomes the subject; seal stamp 250ms; enforcement line |
| 7 | 72.3 – 86.3 | 2169–2589 | QP-002 unrelated-inflow | New exhibit re-stamp → Round I → Round II (revised badge on sentinel-02 0.74→0.66) → tally 1/3 → verdict stamp REJECT |
| 8 | 86.3 – 92.63 | 2589–2779 | Dissent close-up | The revised ballot enlarged; others line; ACTION BLOCKED strip |
| 9 | 92.63 – 96.8 | 2779–2904 | Docket | App §1 docket, QP-002/QP-001 rows (latest-first, app order) |
| 10 | 96.8 – 102.3 | 2904–3069 | Fact & proof detail | App §2 decoded fact + BlockProver precompile trace |
| 11 | 102.3 – 106.5 | 3069–3195 | Signed ballots | Round II signature lines (secp256k1), bound to factHash |
| 12 | 106.5 – 111.0 | 3195–3330 | Raw proof bytes | App rawbytes component, txBytes as proven |
| 13 | 111.0 – 119.1 | 3330–3573 | Close | QP serif close plate + canon Kinocut credit |

One numbering system: chapters `01–05` (chrome state), cases `QP-001/QP-002` everywhere
(chamber meta, docket, close-ups). No version markers, no lane status, no diagnostics on
screen (Astra #7).

## 3. Motion inventory (authored GSAP only — `window.__timelines.master`, paused, seeked by runtime)

- Eases: `power2.out` (state changes), `power3.out` (entrances), `expo.out` (hook/close).
  Nothing mechanical; nothing drifts. **ZERO zoompan / ken-burns anywhere.**
- Ballot placement: 180ms ease-out, translateY(4px) (DESIGN-SYSTEM motion contract).
- Stamps (exhibit, verdict, seal): 250ms ease-out, scale 1.18→1 (verdict/seal keep −4°/−8°).
- Entrances: rise 12–26px + fade, 0.4–0.7s, staggered; each hold is stationary.
- Tally count-up: seek-safe digit swap-stack (1→2→3 at 64.55/65.15) — no `onUpdate`
  (GSAP suppresses callbacks on silent seeks; renderer verified this).
- Text-state changes (round boxes sealed→opened, awaiting→verdict, tally line): opacity
  swap stacks with lint-mandated hard-kill `tl.set`s for non-linear seek safety.
- Chrome: masthead settles in at 0.1s; progress tick fills 0→100% linear over 119.1s.
- Chapter state text swaps at 21.5/49.35/92.65/111.0 — same clock as the evidence.

## 4. Terminal capture (the one content exception)

Re-captured for v3 per Astra ruling 6 (no personal shell context): prompt is `buidl-ctc %`,
command `npm run verify-live` — no username, no home path. The REAL process ran against
CC3 testnet (read-only; exit 0; this run: attested height 25965850, proof 6995ms, verify
501ms, decode 349ms, `VERIFY-LIVE: PASS`). Staged midnight-ledger terminal page (v2's
`termpage.html`, QP dark tokens) + Playwright recording, 1920×1080 → 23.97s mp4 (30fps).
Script: `/private/tmp/qp-video-v3/capture-terminal-v3.js` (adapted from v2's).
Render fix: video starts at 20.0s UNDER the opaque rest view (z-order) so it is fully
decoded when the 21.5s cut reveals it — no black first-frame; a still of the final PASS
frame (`assets/terminal-hold.png`) continues 43.93→49.35 (identical pixels, seamless join).

## 5. Chrome — ONE subordinate kyanite system (canon-copied)

Copied patterns from content-os `HYPERFRAMES_CHROME_CANON` + the kyanite `.topbar`
component idiom, per CEO ("copy what's being used by the Content OS") and Astra #1:

- Masthead: kyanite topbar panel — `--midnight #071018` base, `rgba(202,224,234,0.20)`
  hairline, 11px bevel clip-path (canon), JetBrains Mono 12px/800/0.14em uppercase.
  Left `KYANITE LABS / QUORUMPROOF` in measure cyan `#00FFE6` with the canon tri-dash
  (cyan + amber; magenta dash omitted — see §7). Right: chapter state in proof amber `#FFD11A`.
- Progress: 3px bottom tick — track `rgba(169,163,153,0.45)` (QP `--rule-strong`
  derived), fill `#FFD11A`, linear.
- Endplate credit: `EDITED WITH KINOCUT · KINOCUT.DEV` (canon), ink-faint, 12px.
- Footprint ≈ 60px of 1080 ≈ **5.6%** (≤ 5–8% target); content aperture ≈ 94%.

Chrome uses its own mono voice (JetBrains) precisely so it never competes with the app's
IBM Plex Mono evidence. Brass `--seal` appears ONLY on the app's own seal + exhibit stamps
(Astra #1). The "DARK" theme toggle stays because it is the app's real masthead.

## 6. Gates run (self lane)

- `hyperframes lint`: **0 errors** (1 warning `composition_file_too_large` — ACCEPTED:
  Astra #2 forbids sub-composition nesting; the single-file composition IS the one
  coordinate grid).
- `hyperframes validate`: **no console errors; 180 text elements pass WCAG AA.**
- Token-purity audit (`audit/token-audit.mjs`, mechanical): **PASS — 27 literals, 0
  offenders** across `hyperframes/index.html` (all colors/fonts trace to QP
  DESIGN-SYSTEM.md ∪ kyanite-system.css ∪ content-os canon). Output:
  `audit/token-audit-v3.json`.
- Saturation robot (`kino video-quality-check`, `audit/quality-check-v3.json`):
  overall 52.1, 3 checks fail — **adjudicated, not painted to** (§7).
- Boundary self-gate: every cut (14 boundaries) and every hold (26 stills) extracted from
  the actual render (`stills/`) and inspected frame-by-frame. Fixed during iterations:
  swap-stack positioning bug (text escaping the grid), exhibit/certificate row reveals,
  certificate issuing only after verdict, digit count-up seek-safety, round-box swap
  width, terminal black first-frame (decode run-up), roster/docket/dissent/sigs vertical
  centering. Final render re-inspected at the terminal cut (645/646/650), hold join
  (1363/1365) and final frame (3572).

## 7. Saturation-robot adjudication (measure → record → adjudicate; nothing invented)

| Robot finding | Value | Adjudication |
|---|---|---|
| saturation FAIL | 1.3% (SATAVG) | **By design.** The canvas owner is QP's warm-paper institutional ledger — both sanctioned systems specify low-chroma surfaces; color is carried by narrow, semantic accents (verdict green/red on words, brass on seal/stamps only, amber chrome ≤5.6% area). The v2 crime was saturated architecture; the fix is restraint, not new hues. NO hues invented. |
| contrast FAIL | y-std 1.4 | The metric measures whole-frame luma spread (paper field dominates every frame), not text legibility. Local evidence contrast: ink `#1B2A41` on paper `#FBFAF7` ≈ 13.3:1; hyperframes validate passed 180 text elements on WCAG AA. |
| temporal_motion FAIL | 97% near-static | **Commissioned.** Astra #3: "reading surfaces stationary; motion = state changes + local emphasis; deliberate cuts into detail views followed by stable holds. Nothing drifts, ever." This is a ledger, not I2V footage. |

Brightness 178.8 ✓ · audio −17.8 LUFS ✓ · color balance 0.5% ✓.

## 8. Audio

Mux: `ffmpeg -i demo-video-v3-silent.mp4 -i docs/audio/program-mix-48k-final.wav
-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac 192k -shortest → demo-video-v3.mp4`.
Voice: Simon-clone local Qwen3-TTS lane, gated in by VOICE-LANE receipt
(`docs/audio/voice-lane-provision-receipt.json` — cloud_tts_used: false). Video and audio
are both exactly 119.100s — voice never stretched, video never trimmed.

## 9. Package layout

```
docs/video-v3/
├── V3-BUILD.md                  ← this file
├── TASTECHECK-LEDGER.md         ← self-attested rows (independent re-runs follow)
├── build-pkg.mjs                ← generates hyperframes/index.html from seed-trace.json
├── hyperframes/                 ← the Hyperframes package (index.html + hyperframes.json + assets/)
│   └── assets/ (app fonts, JetBrainsMono, gsap.min.js, terminal-verify-live.mp4, terminal-hold.png)
├── render/demo-video-v3.mp4     ← VOICED master (1080p30, 119.1s)
├── render/demo-video-v3-silent.mp4
├── stills/                      ← boundary + hold frames from the actual render
├── snapshots/                   ← hyperframes snapshot verification frames (iteration record)
└── audit/ (token-audit.mjs, token-audit-v3.json, quality-check-v3.json)
```
(`node_modules/` in hyperframes/ is git-ignored — gsap + @hyperframes/core, local, zero spend.)

## 10. Honest notes / residuals

- The clerk scenario buttons show short tx labels composed from the seed hashes
  (`0x27e554…80d7 — repayment within policy window`); the "note" strings are editorial
  captions in the app's own format (the live app fills them from `/api/health`), kept
  consistent with the case facts.
- Netstatus shows `CC3 TESTNET · ATTESTED HEIGHT 25,923,250` — taken from the seed
  cases' `attestedHeight` (the CC3 height at proof time) so on-screen state matches the
  evidence timeline; the terminal chapter shows its own (later, real) run values, which is
  the honest state of a live network.
- The film's chapters show the dashboard in QP light (the designed default and the
  counter-position the DESIGN-SYSTEM commits to); 'midnight ledger' appears as the real
  terminal's own theme. No theme toggle is performed on camera.
