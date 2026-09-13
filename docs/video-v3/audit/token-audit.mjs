#!/usr/bin/env node
/* QP-VIDEO-v3 TOKEN-PURITY AUDIT (mechanical, no judgment calls)
 * Every color literal and font-family in the authored hyperframes package must trace to:
 *   [QP]   ~/workspaces/buidl-ctc/DESIGN-SYSTEM.md (implemented in src/web/style.css)
 *   [KY]   ~/workspaces/kyanite-labs/kyanite-landing/static/css/kyanite-system.css
 *   [CANON] content-os video-factory HYPERFRAMES_CHROME_CANON (copied patterns only)
 * NAMED EXCLUSIONS (CEO v2 rejection): magenta #ff1a6e, blue #087dcc — use = FAIL.
 * Usage: node token-audit.mjs <file...> [--json out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';

// ---- union whitelist: uppercase hex (no #) -> provenance ---------------------------------
const TOKENS = {
  // [QP] light theme (DESIGN-SYSTEM.md build contract / src/web/style.css)
  FBFAF7: 'QP light --paper', FFFFFF: 'QP light --paper-raised', D8D4CC: 'QP light --rule',
  A9A399: 'QP light --rule-strong', '1B2A41': 'QP light --ink', '5A6472': 'QP light --ink-dim',
  '8B93A0': 'QP light --ink-faint', '1F7A4D': 'QP light --verdict-execute', A03225: 'QP light --verdict-reject',
  '8C6D2F': 'QP light --seal (brass: seal + exhibit stamps ONLY)', '1B4965': 'QP light --link',
  // [QP] dark 'midnight ledger'
  '16181D': 'QP dark --paper', '1E2128': 'QP dark --paper-raised', '3A3E48': 'QP dark --rule',
  '555B68': 'QP dark --rule-strong', EDE9DF: 'QP dark --ink', A8A498: 'QP dark --ink-dim',
  '3DBE84': 'QP dark --verdict-execute', E06A5A: 'QP dark --verdict-reject',
  C9A45C: 'QP dark --seal (brass: seal + exhibit stamps ONLY)', '7FA8C9': 'QP dark --link',
  // [KY] kyanite-system.css (all passes present in the sanctioned file)
  '030608': 'KY --void (latest pass)', '05070B': 'KY --void (pass 1)', '04070A': 'KY --void (pass 2)',
  '0B131D': 'KY --basalt (pass 1)', '0B1720': 'KY --basalt (pass 2)', '09151E': 'KY --basalt (pass 3)',
  '071018': 'KY --midnight (kyanite topbar base)', '08141D': 'KY --panel (solid pass)',
  '0A1924': 'KY --panel-strong (solid pass)', '07131B': 'KY --panel-fill (solid pass)', '050B10': 'KY --field (solid pass)',
  F6FBFF: 'KY --text (later pass)', F3F8FF: 'KY --text (pass 1)', C9D7E2: 'KY --text-2 (later)', C3D4E2: 'KY --text-2 (pass 1)',
  '8DA0AF': 'KY --muted (later)', '8297AA': 'KY --muted (pass 1)', '657887': 'KY --muted-2 (later)', '5D7082': 'KY --muted-2 (pass 1)',
  FFD11A: 'KY --amber (canon proof)', '00FFE6': 'KY --cyan (canon measure/signal)', '7EDBA5': 'KY --green', FF1A3D: 'KY --red',
  '05070A': 'CANON base (content-os control-plane)',
  F4F7FB: 'CANON text (content-os control-plane)',
};
// rgb() triplets whitelisted (alpha-free comparison)
const RGB_TRIPLETS = {
  '202,224,234': 'KY line/hairline rgb (anti-glass + later passes)',
  '221,234,241': 'KY line rgb (pass 1)',
  '216,234,242': 'KY line rgb (pass 2)',
  '243,248,255': 'KY line-soft rgb (pass 1)',
  '244,247,251': 'CANON tick track / kyanite white-line rgb (later passes)',
};
// named exclusions — presence anywhere = FAIL (CEO v2 rejection)
const EXCLUDED = {
  FF1A6E: 'magenta — named in CEO v2 rejection (adjudicated out of QP-VIDEO-v3 chrome)',
  '087DCC': 'blue — named in CEO v2 rejection (adjudicated out of QP-VIDEO-v3 chrome)',
};
// sanctioned font families (font stacks may use these + generic system fallbacks)
const FONT_WHITELIST = [
  'Source Serif 4', 'Iowan Old Style', 'Georgia', 'serif', // QP serif stack
  'IBM Plex Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace', // QP mono stack
  'JetBrains Mono', // [CANON] chrome microtype
];

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const files = args.filter((a) => !a.startsWith('--') && a !== (jsonOut || ''));

const offenders = [];
let literals = 0;
const perFile = {};

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const stats = { file: f, hex: 0, rgb: 0, fonts: 0, offenders: [] };
  // strip strings' content? no — audit ALL literals including in data URIs (svg favicon uses %23 encoding)
  const hexRe = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let m;
  while ((m = hexRe.exec(src)) !== null) {
    let h = m[1].toUpperCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    literals++; stats.hex++;
    if (EXCLUDED[h]) stats.offenders.push({ kind: 'hex', value: '#' + h, why: 'EXCLUDED: ' + EXCLUDED[h] });
    else if (!TOKENS[h]) stats.offenders.push({ kind: 'hex', value: '#' + h, why: 'not in union token set' });
  }
  const rgbRe = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:[,/)]|$)/g;
  while ((m = rgbRe.exec(src)) !== null) {
    const t = `${m[1]},${m[2]},${m[3]}`;
    literals++; stats.rgb++;
    const hexEquiv = t.split(',').map((d) => Number(d).toString(16).padStart(2, '0').toUpperCase()).join('');
    if (!RGB_TRIPLETS[t] && !TOKENS[hexEquiv]) {
      stats.offenders.push({ kind: 'rgb', value: `rgb(${t})`, why: 'not in union token set' });
    }
  }
  const fontRe = /font-family\s*:\s*([^;}]+)/g;
  while ((m = fontRe.exec(src)) !== null) {
    stats.fonts++;
    const declared = m[1].trim();
    // token indirections resolve to sanctioned stacks defined in :root — traceable by construction
    if (/^var\(--(serif|mono|kymono)\)$/.test(declared)) continue;
    const names = [...declared.matchAll(/["']?([^"',;]+?)["']?\s*(?:,|$)/g)].map((x) => x[1].trim()).filter(Boolean);
    for (const n of names) {
      if (!FONT_WHITELIST.includes(n)) {
        stats.offenders.push({ kind: 'font', value: n, why: 'not a sanctioned font family' });
      }
    }
  }
  perFile[f] = stats;
  offenders.push(...stats.offenders.map((o) => ({ file: f, ...o })));
}

const verdict = offenders.length === 0 ? 'PASS' : 'FAIL';
const report = {
  lane: 'QP-VIDEO-v3',
  audit: 'token-purity (union: QP DESIGN-SYSTEM.md ∪ kyanite-system.css ∪ content-os chrome canon patterns)',
  namedExclusions: EXCLUDED,
  files, totalLiterals: literals, offenderCount: offenders.length, verdict, offenders, perFile,
};
const lines = [];
lines.push(`QP-VIDEO-v3 TOKEN AUDIT — ${verdict}`);
lines.push(`files: ${files.length} · literals scanned: ${literals} · offenders: ${offenders.length}`);
for (const f of files) {
  const s = perFile[f];
  lines.push(`  ${f}: hex=${s.hex} rgb=${s.rgb} font-decls=${s.fonts} offenders=${s.offenders.length}`);
  for (const o of s.offenders) lines.push(`    OFFENDER [${o.kind}] ${o.value} — ${o.why}`);
}
const out = lines.join('\n');
console.log(out);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 2));
process.exit(verdict === 'PASS' ? 0 : 2);
