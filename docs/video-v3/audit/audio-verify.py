#!/usr/bin/env python3
"""Audio-vs-expected-speech-map verifier (the gate the 42s double-voice escaped).
Expected map = caption entries (script + silence-measured timings, deterministic).
RED on: energy in expected gaps (overlap/double-voice class) or no-energy in
expected speech (hole). Runs in seconds; agent-runnable; deterministic.
Usage: audio-verify.py <mix.wav-or-video> <entries.json>"""
import sys, json, subprocess, wave, numpy as np

mix, entries_path = sys.argv[1], sys.argv[2]
entries = json.load(open(entries_path))["entries"] if "entries" in json.load(open(entries_path)) else json.load(open(entries_path))
SR = 48000; WIN = int(0.1 * SR)
raw = subprocess.run(['ffmpeg','-loglevel','error','-i',mix,'-f','f32le','-ac','1','-ar',str(SR),'-'],capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
dur = len(x)/SR
n = len(x)//WIN
rms = np.sqrt((x[:n*WIN].reshape(n,WIN)**2).mean(axis=1))
TH = 0.012  # speech-vs-silence energy floor (post-loudnorm bed floor sits below)
fails = []
for e in entries:
    s0, s1 = int(e['start']/0.1), int(e['end']/0.1)
    # hole check: ≥60% of a caption's span silent = narration missing
    seg = rms[s0:s1]
    if len(seg) and (seg < TH).mean() > 0.6:
        fails.append(f"HOLE {e['start']}-{e['end']}: '{e['text'][:40]}'")
# overlap check: energy ≥ TH inside expected gaps (between consecutive captions, >0.3s gaps)
entries_sorted = sorted(entries, key=lambda e: e['start'])
for a, b in zip(entries_sorted, entries_sorted[1:]):
    g0, g1 = int(a['end']/0.1)+1, int(b['start']/0.1)-1
    if g1-g0 >= 4:  # ≥0.4s expected gap
        seg = rms[g0:g1]
        hot = (seg > TH*2.2).sum()
        if hot/len(seg) > 0.5:
            fails.append(f"OVERLAP {a['end']:.2f}-{b['start']:.2f}: voice energy in expected gap ({hot}/{len(seg)} windows)")
print(f"duration={dur:.2f}s windows={n} speech-th={TH}")
if fails:
    print("RED:"); [print(' ', f) for f in fails]; sys.exit(1)
print("GREEN: speech map matches expected — no holes, no overlap")
