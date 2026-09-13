# CEO real-voice read — QuorumProof demo v2.2 (BACKSTOP PACKAGE)

Simon's literal voice = zero training, exact brand. If the clone gate is
refused or the CEO prefers his own read, record the 6 slabs below and drop
the WAVs in this folder with the EXACT names given — the mux picks them up
unchanged (48 kHz mono WAV per slab, same names as the clone sections).

## One-command recording (macOS, default mic)

    ffmpeg -f avfoundation -i ":0" -ar 48000 -ac 1 -c:a pcm_s16le section-01-hook.wav

(`":0"` = default microphone. Repeat per slab with the right output name.)
sox equivalent: `sox -d -r 48000 -c 1 section-01-hook.wav`
QuickTime fallback: Voice Memos → record → drag file here → convert:
`ffmpeg -i in.m4a -ar 48000 -ac 1 -c:a pcm_s16le section-0N-name.wav`

## Setup (2 minutes)

- Quiet room, soft surfaces; phone/USB mic 15 cm from mouth, slightly off-axis.
- Input level: speak the first line — peaks around -12 dBFS, never touching 0.
- Read each slab in ONE take; pause normally between paragraphs (blank lines).
- Declaratives FALL at the end; the two questions rise; "I'm not okay with
  that." and "That's the product working." get air before and after.
- Do not read the bracketed [timing] lines aloud.

## Slabs and timing marks (chapter anchors)

| # | File (exact name) | Start at | Window |
|---|-------------------|----------|--------|
| 1 | section-01-hook.wav | 0:00.8 | hook cards |
| 2 | section-02-proof.wav | 0:27.5 | live `npm run verify-live` |
| 3 | section-03-fleet.wav | 0:52.5 | dashboard EXECUTE -> REJECT |
| 4 | section-04-audit.wav | 1:42.5 | auditability scroll |
| 5 | section-05-close.wav | 2:05 | end card (video is freeze-padded to fit) |

Slab texts: section-0N-*.take.txt next to this README (exact words, v2 script
of record). Mux order: 1..5 with ~1.5 s air between sections.
