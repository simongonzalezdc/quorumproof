# UltraQA Report — QuorumProof demo video v3

- **Checker:** ULTRAQA CHECK 3 of CEO triple gate (adversarial dynamic e2e QA), 2026-09-12
- **Role:** VALIDATOR — no fixes applied to the artifact; failures returned to the build lane
- **Target:** `docs/video-v3/render/demo-video-v3.mp4` (md5 `32d913b163df425be56f244e59831b68`, verified unchanged after QA)
- **Zero spend, no cloud, read-only except this report.** Local tooling only: ffmpeg 8.1, ffprobe, Python whisper (openai-whisper, `small.pt`, local models dir), PIL/numpy.

## Goal and success criteria

- **Goal (custom behavior):** the film is CEO-safe — no silent span, no broken/unwatchable moment, no gate-law violation survives.
- **Stop condition:** any scenario failure → diagnose with frame/timestamp evidence → record as blocker → stop cycle (findings return to build lane). Max 5 cycles.
- **Safety bounds applied:** no destructive commands, no network, timeouts on every ffmpeg/whisper invocation (60–580s caps), no artifact mutation (md5 verified before/after), temp frames confined to `/tmp/ultraqa-v3/` and removed after.

## Verdict

**GOAL NOT MET — 1 BLOCKER.** All baseline gates, container sanity, audio, readability, motion law, and spoken claims PASS. One gate-law violation survives on the QP-001 verdict panel (ADV-2/ADV-1, misleading-label class).

## Scenario matrix

| ID | User/attacker model | Scenario | Command/harness | Expected signal | Actual result | Status | Evidence | Cleanup |
|----|---------------------|----------|-----------------|-----------------|---------------|--------|----------|---------|
| BASE-1 | Careful reviewer | Container/stream sanity | `ffprobe -show_format -show_streams` | h264 1920×1080 ~30fps, dur 100–140s, aac audio, <80MB | h264 High yuv420p 1920×1080 r30/1; dur 119.100; aac LC 48k mono; 10,622,938 B; video+audio both exactly 119.100s | PASS | ffprobe.json (tmp) | removed |
| BASE-2 | Loudness auditor | EBU R128 + true peak | `ffmpeg -af ebur128=peak=true` | I in −16..−23 LUFS, peak ≤ −1.0 dBTP | I = **−17.8 LUFS**, True peak **−1.7 dBFS**, LRA 4.5 LU; rerun identical | PASS | ffmpeg stderr ×2 | removed |
| BASE-3 | Silence hunter | Silent-hole scan | `silencedetect=n=-60dB:d=3` + per-10s `astats` RMS | No >3s contiguous span < −60dB | Zero silence events; per-10s RMS −16.78..−20.51 dB (12/12 segments), nothing near −60 | PASS | rms10s.txt | removed |
| BASE-4 | Timing auditor | Narration onset vs 0.8/23.0/49.2/92.6/111.0 ±2s | whisper `small` word_timestamps on 16k mux audio | Each chapter onset within ±2s | **0.84 / 22.76 / 49.00 / 92.66 / 110.82** — max deviation 0.24s | PASS | asr/audio16k.json | removed |
| ADV-1 | Frame-by-frame attacker | Boundary watch: frames at ±0.3s around all 12 scene cuts (10.1/21.5/49.35/56.0/68.4/72.3/86.3/92.65/96.8/102.3/106.5/111.0) + 10 claimed motion moments | ffmpeg frame extraction, 66 frames, 22 contact strips | No clipping, no overlap collisions, no half-rendered states | All cuts clean; entrance gaps at cuts are rise+fade reveals per motion law; hook fades clean; tally count-up renders 1/3→2/3→3/3→EXECUTE. **But found the ADV-2 blocker inside the count-up (see ADV-2)** | PASS* | 22 strips (tmp) | removed |
| ADV-2 | Hostile sampler | 12 random timestamps (seed 42: 4.41/4.97/11.63/26.97/27.5/33.54/50.65/60.37/75.99/80.34/87.3/105.44) + chrome label zoom at 12 timestamps + verdict-kicker frames | ffmpeg crops + xstack sheets | No contradictory labels, no production debris, one numbering system, case identity stable | Chrome chapters strictly 01→05 (01 THE PROBLEM, 02 LIVE PROOF, 03 THE FLEET, 04 AUDIT TRAIL, 05 CLOSE); QP-001/QP-002 identity stable across chamber/docket/dissent/sigs; case value 0.05686936645929935 ETH identical in chamber and dissent close-up. **FAIL: QP-001 verdict kicker reads "QUORUM MET — 1/3 APPROVALS · ≥2 REQUIRED" during count-up** | **FAIL** | kk-sheet, chrome-sheet, rnd-sheets (tmp) | removed |
| ADV-3 | Small-screen viewer | Readability probe: 960×540 + 480×270 downscales of evidence-heavy moments; native text-height measurement | ffmpeg scale + PIL dark-row band measurement | Essential evidence legible at 960×540 | PASS at 960×540: VERIFY-LIVE PASS line, EXECUTE + "quorum met", REJECT + "QUORUM NOT MET — 1/3 · ≥2 REQUIRED · ACTION BLOCKED", APPROVE/DENY scores, dissent card all legible. Native text heights: verdict kicker lines 10–11px, sig lines ~17px band, case meta 10px. Hash strings read as texture (supporting detail) | PASS | readability/ sheets | removed |
| ADV-4 | Motion-law auditor | Frame-diff across 13 claimed hold spans (first vs last frame), hot-block localization, quadrant means for global-drift detection; settled tails re-diffed | python3 + PIL/numpy on extracted frames | Reading surfaces pixel-stable on holds; motion local only; zero drift/zoom | No global drift anywhere (hot motion confined to single local blocks: entrance reveals, stamp lands, certificate fill, declared progress tick excluded). Settled tails meanDiff 0.000–0.157, p99 ≤3 (pixel-stable). Terminal 22–26s motion is the declared real capture (content) | PASS | diff/ metrics | removed |
| ADV-5 | AV coherence auditor | Audio present full duration; no audio-only gaps; loudness consistency | BASE-2 + BASE-3 + ffprobe stream durations | Audio continuous 0–119.1s; consistent loudness | Audio continuous (no −60dB events ≥3s; worst 10s RMS −20.5 dB); both streams 119.100s; per-section RMS spread 3.7 dB | PASS | rms10s.txt | removed |
| ADV-6 | Claim verifier | Spoken claims vs script numbers (3.6 ETH, 3/3, 1/3, secp256k1, two of three) via local ASR | whisper small, word timestamps, mux audio | All five claims spoken and matching script | ALL PRESENT: "3.6 ETH" (seg 26.5–32.6), "three out of three, execute" (72.6–76.8), "One out of three, reject" (77.7–83.5), "SECP 256K1" (92.7–98.6), "quorum gate, two of three" (104.0–109.0). Transcript matches `docs/audio/narration/*.tts-text.txt` | PASS | asr/audio16k.json | removed |
| CTR-1 | Hygiene auditor | Dirty worktree: QA changes nothing | `git status --porcelain` before/after + md5 of target | Only pre-existing untracked dirs; artifact byte-identical | Before: `?? docs/audio/`. After: `?? docs/audio/` + `?? docs/video-v3/validation/` (this report, intentional). md5 unchanged | PASS | git output | report kept |
| CTR-2 | Impatient user | Hung commands: all ffmpeg/whisper bounded | `timeout` wrapper on every call (60–580s) | No unbounded waits | All calls completed; slowest = whisper ASR (~2 min), exit 0 | PASS | shell logs | removed |
| CTR-3 | Flake hunter | Flaky gates: rerun verdict-gating measurements | Re-ran ebur128 (identical: −1.7 peak, LRA 4.5) and re-extracted blocker frames from independent decode (identical text) | Same result twice | Reproduced exactly | PASS | rerun-stack.png | removed |
| CTR-4 | Stale-state auditor | Stale state files | n/a — validator consumes no state files; omx `state write` rejected by environment ("canonical mode binding lease namespace identity mismatch") — recorded, non-blocking | n/a | n/a (blocked, safe substitute = this report as state surface) | N/A | omx stderr | none |

## Commands run

- `[0]` `ffprobe -v error -show_format -show_streams -of json <target>` — container sanity
- `[0]` `ffmpeg -af ebur128=peak=true -f null -` (×2) — integrated −17.8 LUFS, peak −1.7 dBFS
- `[0]` `ffmpeg -af silencedetect=n=-60dB:d=3 -f null -` — no silence events
- `[0]` `ffmpeg -af asetnsamples=480000,astats,ametadata=print` — 12× per-10s RMS
- `[0]` `ffmpeg -vn -ac 1 -ar 16000 <target> audio16k.wav` + `whisper audio16k.wav --model small --word_timestamps True` (timeout 580s) — transcript + onsets
- `[0]` ~90× `ffmpeg -ss <t> -frames:v 1 [-vf crop|scale|neighbor]` — ADV-1/2/3/4 frame evidence
- `[0]` python3/PIL/numpy frame-diff harness over 13 holds + 8 settled tails (script inline, no files left)
- All invocations wrapped in `timeout`; no side effects outside `/tmp/ultraqa-v3/`

## Failures found

### BLOCKER-1 (ADV-2 / ADV-1) — Gate-law self-contradiction on QP-001 verdict panel
- **What:** the verdict-panel kicker reads **"QUORUM MET — 1/3 APPROVALS · ≥2 REQUIRED · MEAN CONFIDENCE 0.83"** while the tally counts up. "QUORUM MET" is factually false at 1/3 against the film's own ≥2 gate shown in the same line.
- **Exact span:** visible at **t = 63.933s through t = 64.367s** (absent at 63.900, still present at 64.367, replaced by "2/3" by 64.400) ≈ **0.45–0.5s, ~14 frames at 30fps**. Reproduced on independent decode (flaky rerun PASS).
- **Frame evidence:** verdict panel region (crop x≈1300,y≈370): 63.900 "CONVENE A PROCEEDING TO OPEN THE RECORD" → 63.933–64.367 "Awaiting proceeding / QUORUM MET — 1/3 APPROVALS · ≥2 REQUIRED" → 64.400+ "QUORUM MET — 2/3" → 65.2 "3/3" → 66.6 "EXECUTE".
- **Root cause (from build pkg orientation):** the kicker is a static "QUORUM MET — N/3 APPROVALS · ≥2 REQUIRED · MEAN CONFIDENCE 0.83" string whose N digit swap-animates 1→2→3 (count-up at 64.55/65.15 per V3-BUILD.md §3). "QUORUM MET" must not display until N≥2 — either hold the kicker on "TALLY — N/3 APPROVALS" until met, or swap the "QUORUM MET" phrase in at the 2/3 step. Mirror check: QP-002 has no such transient (goes straight to "REJECT / QUORUM NOT MET — 1/3" between 83.5–84.5, consistent at every frame).
- **User impact:** a paused frame mid-count shows the film asserting a quorum it does not have — exactly the misleading-success class this gate exists for. At 1× playback it reads as a count-up and most viewers will not catch it; a CEO pause-frame or frame-stepped review will.
- **Safety impact:** none physical; reputational — contradicts the film's core claim (quorum discipline).
- **Fix owner:** build lane (hyperframes composition / build-pkg.mjs), NOT this validator.

### Observation-1 (low, non-blocking) — Round I reveal precedes its explanation
The QP-001 (and QP-002) "ROUND I — SECRET BALLOT" panel shows the sealed empty box at 57.0, reveals votes ~58.2, but the explanatory caption "votes sealed — box opened at round II" only lands ~61.0–61.5; the narration explains the secret ballot at ~63.9. For ~3s votes sit under "SECRET BALLOT" with only "ballot box —" as caption. Not a hard violation (sealed state shown first; reveal eventually captioned; QP-002 identical pattern), but consider captioning at reveal.

### Observation-2 (informational)
Dashboard netstatus shows attested height 25,923,250 while the terminal chapter shows its live run at 25,965,850 — documented as honest live-network state in V3-BUILD.md §10. Consistent, no action.

## Fixes applied

None. Validator role: artifact untouched (md5 verified). Blocker returned to the build lane with frame-exact bounds above.

## Cleanup and rollback

- All temp frames, strips, sheets, diff PNGs, ASR outputs under `/tmp/ultraqa-v3/` removed after report writing.
- Repo changes: only this report file (`docs/video-v3/validation/ULTRAQA-REPORT-v3.md`). No commits made. `docs/audio/` untracked state pre-existed and was not touched.
- No child processes left; no state files written (omx state write rejected by environment namespace lease — see CTR-4).

## Residual risks

- ASR onset precision: whisper `small` word timestamps carry ~±0.2s jitter; onsets matched the builder's silencedetect values (0.93/23.08/49.32/92.63/111.07) within 0.25s — far inside the ±2s gate, but a silencedetect re-run on the pre-mix narration stem would be the primary-source check.
- 480×270 legibility was sampled, not gated: essential verdict/PASS lines remain readable but small mono (10px native → 2.5px) is not; 960×540 is the acceptance surface per build spec.
- ADV-1 covers the 12 authored cut boundaries ±0.3s and 10 claimed motion moments; sub-frame artifacts strictly between sampled points (e.g., a 1-frame glitch not at a boundary) were not exhaustively scanned — spot checks at 12 random timestamps found none.
- The QP-001 count-up flash was verified frame-exact at 1/30s granularity around its bounds; onset lies in (63.900, 63.933], clear lies in (64.367, 64.400].

## Evidence index (representative values; raw files removed after QA)

- Container: `format=mov,mp4 dur=119.100000 size=10622938`; streams: `h264 High 1920x1080 30/1 yuv420p` / `aac LC 48000 Hz mono`, both `duration=119.100000`.
- Loudness ×2: `I: -17.8 LUFS`, `LRA: 4.5 LU`, `Peak: -1.7 dBFS`.
- Per-10s RMS (dB): −17.80, −17.20, −18.94, −16.78, −18.50, −20.51, −17.62, −19.06, −18.48, −18.66, −17.04, −18.08.
- Onsets (whisper words): ch1 0.84 "Here's", ch2 22.76 "Look", ch3 49.00 "Now", ch4 92.66 "Every", ch5 110.82 "Quorum".
- Blocker frames: 63.900 pre / 63.933·63.967·64.333·64.367 "QUORUM MET — 1/3" / 64.400 "2/3" (all re-verified on rerun).
- Chrome labels: 5s 01 THE PROBLEM · 15s 01 · 30s 02 LIVE PROOF · 45s 02 · 52s 03 THE FLEET · 70s 03 · 90s 03 · 95s 04 AUDIT TRAIL · 100s 04 · 107s 04 · 115s 05 CLOSE · 118.8s 05.
- Hold diffs (settled tails, mean/p99): fleet 0.095/2.0 · qp1 0.116/1.0 (seal stamp local) · cert 0.157/3.0 · qp2 0.345/1.0 (verdict land local) · dissent 0.000/0.0 · fact 0.002/0.0 · sigs 0.000/0.0 · rawbytes 0.038/1.0 · close 0.412/3.0.
