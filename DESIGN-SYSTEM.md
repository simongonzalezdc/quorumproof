# QuorumProof DESIGN-SYSTEM.md — CEO taste spec (binding)
Interview: 2026-09-07 ~04:55Z, design-system-interview. Authority: CEO live choices. This is the source of truth for the dashboard redesign and every gate judges against.

## Direction (one line)
"Institutional ledger, light-only — a credit-union ledger meets a courtroom transcript: paper surfaces, serif ceremony, mono evidence, audit-dense ruled tables, signature = The Chamber (Exhibit → ballots → quorum → sealed certificate)."

## Decision map
| Dimension | Status | Decision | Consequence |
|---|---|---|---|
| personality | **committed (CEO)** | Institutional: banking-grade, underwriting-infrastructure credibility | Every element reads as audit-grade; zero cuteness |
| aesthetic | **committed (CEO)** | Paper-light institutional ledger; counter-position to the dark-terminal field | Warm-white paper surfaces, ruled lines, document artifacts |
| signature | **committed (CEO)** | **The Chamber**: each deliberation is a formal proceeding — fact enters as stamped EXHIBIT (with proof checks), agents cast ballot cards (name, vote, sig hash — static-parseable), quorum count fills, CERTIFICATE issued as a bordered document with a brass seal-styled stamp + on-chain hash | Ceremony survives screenshots; the mechanic IS the visual |
| density_shape | **committed (CEO)** | Audit-dense: compact ruled tables, tight row rhythm, evidence per screen | An instrument judges can interrogate, not a storyboard |
| type | **committed (CEO)** | Dual voice: serif display (Source Serif/Fraunces class) for headings + certificate document; ONE mono (IBM Plex Mono class) for ALL data — hashes, ballots, timestamps, counts | Gravitas + evidence legibility |
| color_mode | **committed (CEO 09-07 supersedes light-only)** | BOTH themes: light-first default + dark ('midnight ledger') with top-right toggle (aria-pressed, localStorage) | Contrast-gated separately per theme (text ≥4.5:1, marks ≥3:1) |
| reference | assumed (nod owed) | "Bloomberg's restraint on credit-union paper" — courtroom-transcript detail | Craft bar: document realism, not dashboard gloss |
| structure_rhythm | assumed (nod owed) | First viewport = the live Chamber proceeding (exhibit + ballots + verdict + seal) full-bleed; below: docket table of all deliberations (dense rows); click-through: fact/proof detail (raw proof bytes, precompile trace) | Judge's screenshot = the ceremony mid-proceeding |
| imagery_iconography | assumed (nod owed) | None beyond typographic marks + rules + ONE seal glyph; no icon sets, no illustrations | The document is the ornament |
| motion (optional) | assumed | Minimal: ballot placement 150–200ms ease-out, seal stamp 250ms, reduced-motion = full static (labels/order carry all meaning) | Ceremony parses without motion |

## Refusals (defaults this product will NOT use)
1. No gradients/gloss even in dark mode (midnight ledger is MATTE, not neon)
2. No emoji, no playful motifs (no bakery crossover)
3. No gradients, no glassmorphism, no drop-shadow gloss
4. No generic dashboard card grid — ruled tables and document structure instead
5. No icon library — typography, rules, and the seal carry the identity

## Build contract — semantic tokens (dual theme, light-first)
- `--paper` #FBFAF7 · `--paper-raised` #FFFFFF · `--rule` #D8D4CC (hairlines everywhere) · `--rule-strong` #A9A399
- `--ink` #1B2A41 (ledger navy) · `--ink-dim` #5A6472 (≥4.5:1 on paper, gate-verified) · `--ink-faint` #8B93A0 (large/decorative only)
- `--verdict-execute` #1F7A4D · `--verdict-reject` #A03225 (verdict text + fills; never the sole carrier — always paired with the word) · `--seal` #8C6D2F (brass, seal + exhibit stamps ONLY) · `--link` #1B4965
- Type: serif display (self-hosted woff2, weights 500/600/700) + mono (self-hosted, 400/500) — both with verified tabular figures where numeric; body text may use the serif's text weights
- DARK ('midnight ledger', matte): `--paper` #16181D · `--paper-raised` #1E2128 · `--rule` #3A3E48 · `--rule-strong` #555B68 · `--ink` #EDE9DF · `--ink-dim` #A8A498 (gate-verify ≥4.5:1) · `--verdict-execute` #3DBE84 · `--verdict-reject` #E06A5A · `--seal` #C945C? → #C9A45C brass · `--link` #7FA8C9 · same serif+mono; seal stamp reads brass-on-dark
- Structure: hero = Chamber proceeding; § docket table; § fact/proof detail; footer with CC3/testnet status line
- A11y: text ≥4.5:1, marks ≥3:1, keyboard-complete, 320px reflow (tables may scroll horizontally in a wrapper), reduced-motion statics, console-zero
- Judging frame: 1440×900 first viewport shows EXHIBIT + ≥2 ballots + verdict state + seal

## SKILL PROTOCOL (binding, same law as CookiePilot)
Every edit pass consults + applies the relevant tastecheck-suite skills (paths in CookiePilot's DESIGN-SYSTEM skill-protocol section); gates re-run them.

## Next move
CEO nod on the 3 assumption rows → (recommended) same 3-model panel pass (Astra/Grok/Sol) on this spec → Product Team builds to spec → tastecheck gate + ultraqa matrix → artifacts (PDF/video) recorded on the FINAL design → publish + submit only on CEO's explicit go.
