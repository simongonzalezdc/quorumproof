#!/usr/bin/env node
/* QP-VIDEO-v3.1 — Hyperframes package builder (fix pass: Astra 4×P0/2×P1/2×P2 + battery P3s + ultraqa BLOCKER-1).
 * Reuses the APP'S REAL HTML component idioms (src/web/index.html + app.js render functions
 * ported verbatim) rendered as native Hyperframes elements on ONE #master coordinate grid.
 * Case data comes from src/web/seed-trace.json (the app's own deterministic seed).
 * Motion: authored GSAP only (ballot place 180ms, stamp 250ms, entrances, count-ups).
 * Chrome: ONE subordinate kyanite control-plane masthead + 3px progress tick (canon).
 * Seek-safety: reveals are CSS-hidden + opacity fromTo; text-state changes are opacity
 * swap stacks; the count-up is a digit swap-stack gated at N≥2 (ultraqa BLOCKER-1).
 *
 * v6 clock (mix 125.66s — script v2.5 + exicute respell, onsets 0.8/23.18/47.64/97.22/117.26;
 * silencedetect −35dB/0.25s beats): sections re-timed; video PADS to the voice (121.5s).
 * Ceremony fixes: seal exists ONLY on earned, completed certificates (close-ups);
 * chamber certificates stay empty ruled documents until the close-up issues them;
 * ballot secrecy window — Round I places without vote content, votes + "box opened"
 * caption land together at the Round-II reveal; S5 = completed EXECUTE certificate
 * close-up reprise as the final focal subject, close plate demoted to a short tail.
 * Output: hyperframes/index.html
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync('/Users/simongonzalezdecruz/workspaces/buidl-ctc/src/web/seed-trace.json', 'utf8'));

/* ---------- app.js helpers, ported verbatim ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const weiToEth = (hexwei) => (Number(BigInt(hexwei)) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 8 });
const short = (s, n = 10) => (s ? s.slice(0, n + 2) + '…' + (s.length > n + 4 ? s.slice(-4) : '') : '');
const fmtInt = (n) => Number(n).toLocaleString('en-US');
const meanConf = (votes) => {
  const a = votes.filter((v) => v.vote === 'APPROVE');
  return a.length ? a.reduce((s, v) => s + v.confidence, 0) / a.length : 0;
};

/* ---------- case data (film session order: repayment = QP-001, unrelated = QP-002) ---------- */
const byLabel = Object.fromEntries(seed.map((s) => [s.label, s]));
const case1 = { no: 'QP-001', label: 'repayment-received', ...byLabel['repayment-received'] };
const case2 = { no: 'QP-002', label: 'unrelated-inflow', ...byLabel['unrelated-inflow'] };

/* ---------- app component renderers (ported from app.js / index.html) ---------- */
function exhibitRows(f) {
  return `
        <tr class="mv exr"><th>factHash</th><td>${esc(short(f.factHash, 20))}</td></tr>
        <tr class="mv exr"><th>source tx</th><td><span class="evlink">${esc(short(f.txHash, 14))}</span></td></tr>
        <tr class="mv exr"><th>parties</th><td><span class="evlink">${esc(short(f.from, 8))}</span> → <span class="evlink">${esc(short(f.to, 8))}</span></td></tr>
        <tr class="mv exr"><th>value</th><td>${weiToEth('0x' + BigInt(f.valueWei).toString(16))} ETH</td></tr>
        <tr class="mv exr"><th>position</th><td>chainKey ${f.chainKey} · block <span class="evlink">${fmtInt(f.headerNumber)}</span> · tx #${f.txIndex}</td></tr>
        <tr class="mv exr"><th>receipt</th><td>status ${f.receiptStatus ?? '?'} · txType ${f.txType}</td></tr>
        <tr class="mv exr"><th>attested to</th><td>${f.attestedHeight ? fmtInt(f.attestedHeight) : '—'} <span class="hint" style="display:inline;">(CC3 height at proof time)</span></td></tr>`;
}

/* Round-I ballots: vote (.what) and reasoning (.why) carry class "sec" — hidden until the
   Round-II reveal (ballot secrecy window; ultraqa P1-8). Commitment evidence (.who/.sig) shows. */
function ballotRow(v, prev, id, secret) {
  const changed = prev && (prev.vote !== v.vote || Math.abs(prev.confidence - v.confidence) > 1e-9);
  return `
        <div class="ballot mv" id="${id}">
          <div class="ballot-head">
            <span class="who">${esc(v.agentId)}</span>
            ${changed ? '<span class="flip">revised</span>' : ''}
            <span class="what ${esc(v.vote)}${secret ? ' sec' : ''}">${esc(v.vote)} ${v.confidence.toFixed(2)}</span>
          </div>
          <div class="ballot-sub">
            <span class="why${secret ? ' sec' : ''}">${esc(v.reasons.join(' · '))}</span>
            <span class="sig">sig ${esc(short(v.signature, 8))}</span>
          </div>
        </div>`;
}

const SEAL_SVG = (cls, id, arcId) => `
            <svg class="seal ${cls || ''}"${id ? ` id="${id}"` : ''} viewBox="0 0 100 100" role="img" aria-label="QuorumProof brass seal">
              <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="2.2"/>
              <circle cx="50" cy="50" r="39.5" fill="none" stroke="currentColor" stroke-width="0.9"/>
              <text class="seal-center" x="50" y="57.5">QP</text>
            </svg>`;

/* the empty certificate document — pre-decision state. NO seal (Astra P0-1: the seal is
   earned only by a completed decision; it exists solely in the close-up views). */
function emptyCertDoc() {
  return `
          <div class="certificate">
            <div class="cert-doc">
              <h3 class="cert-h">Certificate of quorum decision</h3>
              <table class="ruled cert-table"><tbody>
                <tr><th>decision</th><td>—</td></tr>
                <tr><th>factHash</th><td>—</td></tr>
                <tr><th>policyId</th><td>—</td></tr>
                <tr><th>certHash</th><td>—</td></tr>
                <tr><th>ballots</th><td>—</td></tr>
                <tr><th>issued</th><td>—</td></tr>
              </tbody></table>
            </div>
          </div>`;
}

/* the chamber — the app's §0 component at video type scale */
function chamber(c, idp) {
  if (c === 'awaiting') {
    return `
      <div class="chamber-head">
        <div class="chamber-title">
          <p class="kicker">The Chamber · in re</p>
          <h2 class="case-name">—</h2>
        </div>
        <p class="case-meta">no proceeding on the record</p>
      </div>
      <div class="chamber-grid">
        <article class="exhibit">
          <div class="exhibit-stampwrap">
            <span class="exhibit-stamp mv" id="${idp}exstamp">Exhibit&nbsp;A</span>
            <span class="exhibit-stampnote">fact not yet verified</span>
          </div>
          <table class="ruled"><tbody>
            <tr><th>factHash</th><td>—</td></tr>
          </tbody></table>
          <p class="proof-checks">awaiting proof</p>
        </article>
        <article class="ballots">
          <section class="round">
            <h3 class="round-h"><span>Round I — secret ballot</span><span class="round-box">ballot box —</span></h3>
            <div class="ballotlist"><p class="empty">no ballots cast</p></div>
          </section>
          <section class="round">
            <h3 class="round-h"><span>Round II — debate &amp; revision</span><span class="round-box">ballot box —</span></h3>
            <div class="ballotlist"><p class="empty">no ballots cast</p></div>
          </section>
        </article>
        <article class="outcome">
          <p class="verdict">Awaiting proceeding</p>
          <p class="tally">convene a proceeding to open the record</p>
          ${emptyCertDoc()}
        </article>
      </div>`;
  }
  const d = c.data;
  const f = d.trace.fact;
  const cert = d.trace.certificate;
  const r1 = d.trace.rounds[0].votes;
  const r2 = d.trace.rounds[1].votes;
  const t = d.trace.timings;
  const met = cert.decision === 'EXECUTE';
  const q = cert.quorum;
  const mc = meanConf(r2).toFixed(2);
  /* count-up digit stack gated at N≥2 (ultraqa BLOCKER-1): the QUORUM MET line never
     shows with fewer than the required approvals. EXECUTE reveals at 2, counts to 3. */
  const digits = met
    ? `<span class="digitbox" id="${idp}digits"><span class="on">2</span><span>3</span></span>`
    : `<span>1</span>`;
  const tallyMet = met
    ? `QUORUM MET — ${digits}/${q.fleetSize} APPROVALS · ≥${q.required} REQUIRED · MEAN CONFIDENCE ${mc}`
    : `QUORUM NOT MET — <span>1</span>/${q.fleetSize} APPROVALS · ≥${q.required} REQUIRED · ACTION BLOCKED`;
  return `
      <div class="chamber-head">
        <div class="chamber-title">
          <p class="kicker">The Chamber · in re</p>
          <h2 class="case-name">${esc(c.label)}</h2>
        </div>
        <p class="case-meta">CASE No. ${c.no} · CONVENED ${esc(cert.createdAt)}<br/>BOUND TO factHash ${esc(short(cert.factHash, 10))} · CHAINKEY ${f.chainKey}</p>
      </div>
      <div class="chamber-grid">
        <article class="exhibit">
          <div class="exhibit-stampwrap">
            <span class="exhibit-stamp mv" id="${idp}exstamp">Exhibit&nbsp;A</span>
            <span class="exhibit-stampnote">verified via ${esc(f.verifiedVia)}</span>
          </div>
          <table class="ruled"><tbody>${exhibitRows(f)}</tbody></table>
          <p class="proof-checks mv" id="${idp}proofchecks">PROOF <span class="ok">VERIFIED</span> ${t.proofMs}MS · PRECOMPILE <span class="ok">PASS</span> ${t.verifyMs}MS · DECODE <span class="ok">PASS</span> ${t.decodeMs}MS · DELIBERATION ${t.deliberateMs}MS</p>
        </article>
        <article class="ballots">
          <section class="round">
            <h3 class="round-h"><span>Round I — secret ballot</span><span class="round-box swap"><span class="on">ballot box —</span><span>votes sealed — box opened at round II</span></span></h3>
            <div class="ballotlist">${r1.map((v, i) => ballotRow(v, null, idp + 'r1b' + i, true)).join('')}</div>
          </section>
          <section class="round">
            <h3 class="round-h"><span>Round II — debate &amp; revision</span><span class="round-box swap"><span class="on">ballot box —</span><span>box ${esc(short(d.trace.ballotBoxHash, 8))}</span></span></h3>
            <div class="ballotlist">${r2.map((v, i) => ballotRow(v, r1[i], idp + 'r2b' + i, false)).join('')}</div>
          </section>
        </article>
        <article class="outcome">
          <div class="swap verdict-swap">
            <p class="verdict on">Awaiting verdict</p>
            <p class="verdict ${met ? 'EXECUTE' : 'REJECT'}">${cert.decision}</p>
          </div>
          <p class="tally swap"><span class="on">quorum gate — ≥${q.required} of ${q.fleetSize} approvals required</span><span>${tallyMet}</span></p>
          ${emptyCertDoc()}
        </article>
      </div>`;
}

/* masthead + clerk — the app's own header strip (§ mark in ink: brass stays seal/stamps-only) */
function masthead() {
  return `
    <header class="masthead">
      <div class="brand">
        ${SEAL_SVG('brand-seal masthead-seal', null, 'sealarc-mast')}
        <div class="brand-text">
          <h1 class="brand-name">QuorumProof</h1>
          <p class="brand-tag">an agent fleet that reaches auditable decisions from attestcoin-verified cross-chain facts</p>
        </div>
      </div>
      <div class="masthead-right">
        <button type="button" class="themetoggle" aria-pressed="false">Dark</button>
        <p class="netstatus"><span class="dot live"></span><span>CC3 TESTNET · ATTESTED HEIGHT ${fmtInt(case1.data.trace.fact.attestedHeight)}</span></p>
      </div>
    </header>
    <div class="clerk">
      <span class="clerk-label">Clerk’s desk</span>
      <div class="scenarios">
        <button type="button" class="scenario"><span class="no">No.&nbsp;1</span>repayment-received<span class="note">0x27e554…80d7 — repayment within policy window</span></button>
        <button type="button" class="scenario"><span class="no">No.&nbsp;2</span>unrelated-inflow<span class="note">0x890dba…c744 — unsolicited inflow, unknown recipient</span></button>
      </div>
    </div>`;
}

/* roster — the app's §3 fleet roster component */
function rosterView() {
  const rows = case1.data.fleetRoster.map((a, i) => `
        <tr class="mv" id="ros${i}"><th>${esc(a.agentId)}</th><td>${esc(a.kind)} · ${esc(a.agentAddress)}<br/><span class="hint">${esc(a.charter)}</span></td></tr>`).join('');
  return `
    <div class="detail-col wide centered">
      <p class="case-strip mv">THE FLEET · THREE AGENTS, THREE MANDATES · EPHEMERAL SECP256K1 CONTROL KEYS</p>
      <h2 class="detail-h mv">Fleet roster</h2>
      <p class="hint mv">Spawned per session; every ballot is signed and locally audited, recoverable on-chain by QuorumRegistry.</p>
      <table class="ruled roster-table"><tbody>${rows}</tbody></table>
    </div>`;
}

/* certificate close-up — the cert-doc component becomes the subject (earned seal lives here) */
function certView(c, stripNote, idp) {
  const d = c.data;
  const cert = d.trace.certificate;
  const met = cert.decision === 'EXECUTE';
  return `
    <div class="detail-col cert-detail">
      <p class="case-strip mv">${c.no} · ${esc(c.label)} · ${stripNote || 'CERTIFICATE OF QUORUM DECISION'}</p>
      <div class="cert-doc big mv">
        <h3 class="cert-h">Certificate of quorum decision</h3>
        <table class="ruled cert-table"><tbody>
          <tr class="mv"><th>decision</th><td class="cert-decision-big ${met ? 'ok' : 'bad'}">${cert.decision} — ${met ? 'quorum met' : 'quorum not met'}</td></tr>
          <tr class="mv"><th>factHash</th><td>${esc(short(cert.factHash, 24))}</td></tr>
          <tr class="mv"><th>policyId</th><td>${esc(short(cert.policyId, 24))}</td></tr>
          <tr class="mv"><th>certHash</th><td>${esc(short(cert.certHash, 24))}</td></tr>
          <tr class="mv"><th>ballots</th><td>${cert.votes.length} signed · audit <span class="ok">clean</span></td></tr>
          <tr class="mv"><th>issued</th><td>${esc(cert.createdAt)}</td></tr>
        </tbody></table>
        <div class="cert-sealrow">${SEAL_SVG('big-seal mv', null, 'sealarc-' + idp)}
          <div class="seal-caption">
            <p class="seal-word">SEALED</p>
            <p class="seal-micro">QUORUMPROOF · CREDITCOIN CC3</p>
            <p class="enforcement big-enf mv">all ballots signature-verified · EIP-191 recovery · QuorumRegistry CC3-ready — records on-chain on deploy · deterministic fleet</p>
          </div>
        </div>
      </div>
    </div>`;
}


/* REJECT verdict close-up — QP-002 gets the same focal payoff class as EXECUTE */
function rejectView(c) {
  const d = c.data;
  const cert = d.trace.certificate;
  return `
    <div class="detail-col centered">
      <p class="case-strip mv">${c.no} · ${esc(c.label)} · VERDICT</p>
      <div class="reject-plate mv">
        <p class="reject-word bad">REJECT</p>
        <p class="reject-line">QUORUM NOT MET — ${cert.quorum.approvals}/${cert.quorum.fleetSize} APPROVALS · ≥${cert.quorum.required} REQUIRED</p>
        <p class="reject-line">ACTION BLOCKED · CERTIFICATE RECORDED</p>
      </div>
    </div>`;
}

/* dissent close-up — the revised ballot becomes the subject */
function dissentView(c) {
  const d = c.data;
  const v2 = d.trace.rounds[1].votes;
  const sentinel = v2.find((v) => v.agentId === 'sentinel-02');
  const cert = d.trace.certificate;
  const others = v2.filter((v) => v.agentId !== 'sentinel-02')
    .map((v) => `${esc(v.agentId)} ${esc(v.vote)} ${v.confidence.toFixed(2)}`).join(' · ');
  return `
    <div class="detail-col centered">
      <p class="case-strip mv">${c.no} · ${esc(c.label)} · ROUND II — THE REVISED BALLOT, ON THE RECORD</p>
      <div class="ballot big-ballot mv">
        <div class="ballot-head">
          <span class="who">${esc(sentinel.agentId)}</span>
          <span class="flip">revised</span>
          <span class="what ${esc(sentinel.vote)}">${esc(sentinel.vote)} ${sentinel.confidence.toFixed(2)}</span>
        </div>
        <div class="ballot-sub">
          <span class="why">${esc(sentinel.reasons.join(' · '))}</span>
          <span class="sig">sig ${esc(short(sentinel.signature, 8))}</span>
        </div>
      </div>
      <p class="dissent-others mv">ROUND II · ${others}</p>
      <p class="dissent-block bad mv">QUORUM NOT MET — ${cert.quorum.approvals}/${cert.quorum.fleetSize} APPROVALS · ≥${cert.quorum.required} REQUIRED · ACTION BLOCKED, CERTIFICATE RECORDED</p>
    </div>`;
}

/* docket — the app's §1 docket, latest first (app render order) */
function docketView() {
  const rows = [case2, case1].map((c) => {
    const cert = c.data.trace.certificate;
    const f = c.data.trace.fact;
    return `
        <tr class="mv">
          <td class="num"><span class="openrow">${c.no}</span></td>
          <td class="cause">${esc(c.label)}</td>
          <td><span class="evlink">${esc(short(f.txHash, 10))}</span></td>
          <td>${cert.quorum.approvals}/${cert.quorum.fleetSize} (≥${cert.quorum.required})</td>
          <td class="decision ${esc(cert.decision)}">${esc(cert.decision)}</td>
          <td>${esc(short(cert.certHash, 8))}</td>
          <td>${esc(cert.createdAt)}</td>
        </tr>`;
  }).join('');
  return `
    <div class="detail-col wide centered">
      <p class="case-strip mv">DOCKET OF PROCEEDINGS · CREDITCOIN CC3 TESTNET</p>
      <table class="ruled docket big-table">
        <thead><tr><th class="num">No.</th><th>cause</th><th>source tx</th><th class="num">approvals</th><th>decision</th><th>certHash</th><th>convened</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="hint mv">The decision becomes a Creditcoin fact that any lending protocol can consume.</p>
    </div>`;
}

/* §2 fact + trace detail (both real tables, enlarged) */
function proofView(c) {
  const d = c.data;
  const f = d.trace.fact;
  const t = d.trace.timings;
  const art = f.proofArtifacts;
  const factRows = `
        <tr class="mv"><th>factHash</th><td>${esc(f.factHash)}</td></tr>
        <tr class="mv"><th>from</th><td>${esc(f.from)}</td></tr>
        <tr class="mv"><th>to</th><td>${esc(f.to)}</td></tr>
        <tr class="mv"><th>value</th><td>${weiToEth('0x' + BigInt(f.valueWei).toString(16))} ETH (${fmtInt(f.valueWei)} wei)</td></tr>
        <tr class="mv"><th>txType</th><td>${f.txType}</td></tr>
        <tr class="mv"><th>receipt status</th><td>${f.receiptStatus ?? '?'}</td></tr>
        <tr class="mv"><th>factHash preimage</th><td>keccak256(chainKey ++ headerNumber ++ txHash ++ verified)</td></tr>`;
  const traceRows = `
        <tr class="mv"><th>verification</th><td><span class="ok">verified</span> — precompile staticCall</td></tr>
        <tr class="mv"><th>BlockProver</th><td><span class="evlink">0x…FD2</span> on CC3 testnet (eth_call/staticCall)</td></tr>
        <tr class="mv"><th>proof build</th><td>${t.proofMs} ms — hosted Attestcoin Proof Builder (testnet)</td></tr>
        <tr class="mv"><th>precompile verify</th><td>${t.verifyMs} ms — verifySingle() staticCall against 0x…FD2</td></tr>
        <tr class="mv"><th>on-chain decode</th><td>${t.decodeMs} ms — <span class="evlink">EvmV1Decoder 0x731c…9f9f</span> (eth_call)</td></tr>
        <tr class="mv"><th>merkle root</th><td>${art ? esc(short(art.merkleRoot, 16)) : '—'}</td></tr>
        <tr class="mv"><th>merkle siblings</th><td>${art ? art.merkleSiblings.length + ' entries' : '—'}</td></tr>
        <tr class="mv"><th>continuity</th><td>${art ? `lower-endpoint ${esc(short(art.continuity.lowerEndpointDigest, 8))} · ${art.continuity.roots.length} roots` : '—'}</td></tr>`;
  return `
    <div class="detail-col wide">
      <p class="case-strip mv">${c.no} · FACT &amp; PROOF DETAIL · BLOCKPROVER 0x…FD2 ON CC3</p>
      <div class="pd-grid">
        <div>
          <h3 class="sub-h">Decoded fact</h3>
          <table class="ruled small-table"><tbody>${factRows}</tbody></table>
        </div>
        <div>
          <h3 class="sub-h">Precompile trace — BlockProver 0x…FD2 on CC3</h3>
          <table class="ruled small-table"><tbody>${traceRows}</tbody></table>
        </div>
      </div>
    </div>`;
}

/* signed ballots detail — secp256k1 signatures on the record */
function sigsView(c) {
  const d = c.data;
  const r2 = d.trace.rounds[1].votes;
  const rows = r2.map((v, i) => `
        <div class="sig-row mv" id="sg${i}">
          <div class="ballot-head">
            <span class="who">${esc(v.agentId)}</span>
            <span class="what ${esc(v.vote)}">${esc(v.vote)} ${v.confidence.toFixed(2)}</span>
          </div>
          <div class="sig-full">${esc(v.signature)}</div>
        </div>`).join('');
  return `
    <div class="detail-col wide centered">
      <p class="case-strip mv">${c.no} · EVERY BALLOT SIGNED · SECP256K1 · SIGNATURES RECOVERED + VERIFIED · EIP-191 · QUORUMREGISTRY CC3-READY</p>
      <p class="hint mv">Round II ballots, signature on the record — bound to factHash ${esc(short(d.trace.certificate.factHash, 10))}</p>
      ${rows}
    </div>`;
}

/* raw proof bytes — the real txBytes, large, filling the canvas (stationary single page) */
function bytesView(c) {
  const f = c.data.trace.fact;
  return `
    <div class="detail-col wide centered">
      <p class="case-strip mv">${c.no} · RAW PROOF BYTES — TXBYTES AS PROVEN INTO THE CC3 PRECOMPILE</p>
      <div class="rawbytes mv">
        <summary>Raw proof bytes — txBytes · ${(f.txBytes.length - 2) / 2} bytes · factHash ${esc(short(f.factHash, 10))}</summary>
        <pre class="bytes">${esc(f.txBytes)}</pre>
      </div>
    </div>`;
}

/* ---------- assembly ---------- */
const TERM_DUR = Number(process.env.TERM_DUR || '23.95'); /* actual capture length, set after recapture */
const TERM_START = 19.8333;   /* 1.5s decode run-up UNDER the opaque rest view */
const TERM_CUT = 21.3333;     /* the visible cut into the terminal */
const TERM_END = TERM_START + TERM_DUR;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>QP-VIDEO-v3.1</title>
<style>
/* ============ UNION TOKENS — audited set (audit/token-audit.mjs) ============
   [QP]  DESIGN-SYSTEM.md build contract, both themes
   [KY]  kyanite-system.css (latest pass values)
   [CANON] content-os control-plane chrome patterns (JetBrains Mono microtype) */
:root {
  /* [QP] light (canvas owner) */
  --paper: #FBFAF7; --paper-raised: #FFFFFF; --rule: #D8D4CC; --rule-strong: #A9A399;
  --ink: #1B2A41; --ink-dim: #5A6472; --ink-faint: #8B93A0;
  --verdict-execute: #1F7A4D; --verdict-reject: #A03225; --seal: #8C6D2F; --link: #1B4965;
  /* [QP] dark ('midnight ledger' — lives inside the terminal capture content) */
  --dpaper: #16181D; --dpaper-raised: #1E2128; --drule: #3A3E48; --drule-strong: #555B68;
  --dink: #EDE9DF; --dink-dim: #A8A498; --dexecute: #3DBE84; --dreject: #E06A5A; --dseal: #C9A45C; --dlink: #7FA8C9;
  /* [KY] chrome idiom */
  --ky-midnight: #071018; --ky-hairline: rgba(202, 224, 234, 0.20);
  --amber: #FFD11A; --measure: #00FFE6;
  --track: rgba(169, 163, 153, 0.45); /* [QP] --rule-strong derived tick track */
  /* fonts */
  --serif: 'Source Serif 4', 'Iowan Old Style', Georgia, serif;      /* [QP] */
  --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace; /* [QP] */
  --kymono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace; /* [CANON] chrome only */
}

@font-face { font-family: 'Source Serif 4'; src: url('assets/source-serif-4-var.woff2') format('woff2'); font-weight: 200 900; font-style: normal; font-display: block; }
@font-face { font-family: 'IBM Plex Mono'; src: url('assets/ibm-plex-mono-400.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: block; }
@font-face { font-family: 'IBM Plex Mono'; src: url('assets/ibm-plex-mono-500.woff2') format('woff2'); font-weight: 500; font-style: normal; font-display: block; }
@font-face { font-family: 'IBM Plex Mono'; src: url('assets/ibm-plex-mono-600.woff2') format('woff2'); font-weight: 600; font-style: normal; font-display: block; }
@font-face { font-family: 'JetBrains Mono'; src: url('assets/JetBrainsMono.ttf') format('truetype'); font-weight: 400 900; font-style: normal; font-display: block; }

* { box-sizing: border-box; }
html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: var(--paper); }

#master { position: relative; width: 1920px; height: 1080px; overflow: hidden; background: var(--paper);
          font: 400 17px/1.5 var(--mono); color: var(--ink); font-variant-numeric: tabular-nums; }

/* views: one coordinate grid; visibility keyed by data-start (runtime) */
.view { position: absolute; inset: 0; background: var(--paper); z-index: 2; }
.view.dark {
  --paper: #16181D; --paper-raised: #1E2128; --rule: #3A3E48; --rule-strong: #555B68;
  --ink: #EDE9DF; --ink-dim: #A8A498; --ink-faint: #8B93A0;
  --verdict-execute: #3DBE84; --verdict-reject: #E06A5A; --seal: #C9A45C; --link: #7FA8C9;
  background: var(--paper);
}
.view.dark .what.APPROVE { color: var(--verdict-execute); }
.view.dark .what.DENY { color: var(--verdict-reject); }
.view.dark .reject-word { color: var(--verdict-reject); }

/* seek-safety: everything a tween reveals starts hidden */
.mv { opacity: 0; }
.cap { position: absolute; left: 50%; transform: translateX(-50%); bottom: 104px; max-width: 1400px;
  z-index: 60; padding: 10px 22px 9px; background: #1B2A41; border: 1px solid #555B68;
  color: #EDE9DF; font: 500 21px/1.4 var(--mono); letter-spacing: 0.01em; text-align: center; opacity: 0;
  box-shadow: 0 2px 14px rgba(10,14,22,0.35); }
.cap.top { top: 132px; bottom: auto; }
.sec { opacity: 0; } /* Round-I vote content: hidden until the box-open reveal */
.swap { position: relative; display: block; }
.swap > span, .swap > p { position: absolute; inset: 0; opacity: 0; }
.swap > .on { position: relative; opacity: 1; }
.verdict-swap { min-height: 52px; }
.digitbox { position: relative; display: inline-block; min-width: 1ch; }
.digitbox > span { position: absolute; left: 0; top: 0; opacity: 0; }
.digitbox > .on { position: relative; opacity: 1; }

/* ============ CHROME — one subordinate kyanite control-plane system ============ */
#chrome { position: absolute; top: 16px; left: 24px; right: 24px; height: 44px; z-index: 50;
  display: flex; align-items: center; justify-content: space-between; padding: 0 20px;
  background: var(--ky-midnight);
  border: 1px solid var(--ky-hairline);
  clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px));
  font-family: var(--kymono); font-size: 12px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
.ky-mark { display: inline-block; vertical-align: -6px; margin-right: 10px; width: 26px; height: 26px; }
  #chrome .sys { color: var(--measure); display: flex; align-items: center; gap: 40px; }
#chrome .sys::before { content: ""; width: 18px; height: 2px; background: var(--measure); box-shadow: 24px 0 0 var(--amber); }
#chrome .state { position: relative; color: var(--amber); height: 15px; min-width: 240px; }
#chrome .state span { position: absolute; right: 0; top: 0; white-space: nowrap; opacity: 0; }
#chrome .state span.on { opacity: 1; }
#progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: 50; background: var(--track); }
#progress span { display: block; width: 0; height: 100%; background: var(--amber); }

/* ============ APP COMPONENTS — QP owns the canvas (video type scale: app × ~1.4) ============ */
.app-page { position: absolute; inset: 0; padding-top: 76px; } /* clears the chrome band */

.masthead { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px;
  padding: 20px 40px 14px; border-bottom: 1px solid var(--rule-strong); background: var(--paper); }
.brand { display: flex; align-items: baseline; gap: 16px; }
.brand-mark { font: 600 36px/1 var(--serif); color: var(--ink); transform: translateY(3px); } /* P2: ink, brass = seal/stamps only */
.brand-name { margin: 0; font: 700 32px/1.1 var(--serif); letter-spacing: 0.01em; color: var(--ink); }
.brand-tag { margin: 5px 0 0; font: 500 13px/1.4 var(--mono); letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-dim); }
.netstatus { margin: 0; display: flex; align-items: center; gap: 10px; font: 400 14px/1 var(--mono); letter-spacing: 0.08em; color: var(--ink-dim); white-space: nowrap; }
.masthead-right { display: flex; align-items: center; gap: 20px; }
.themetoggle { background: var(--paper-raised); color: var(--ink-dim); border: 1px solid var(--rule-strong);
  padding: 8px 16px 7px; font: 500 13px/1.3 var(--mono); text-transform: uppercase; letter-spacing: 0.12em; }
.dot { width: 11px; height: 11px; border-radius: 50%; background: var(--rule-strong); border: 1px solid var(--rule-strong); }
.dot.live { background: var(--verdict-execute); border-color: var(--verdict-execute); }

.clerk { display: flex; align-items: center; gap: 22px; padding: 12px 40px; border-bottom: 1px solid var(--rule); background: var(--paper-raised); }
.clerk-label { font: 600 13px/1 var(--mono); text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-dim); white-space: nowrap; }
.scenarios { display: flex; gap: 10px; }
.scenario { appearance: none; cursor: pointer; background: var(--paper-raised); color: var(--ink); border: 1px solid var(--rule-strong);
  padding: 9px 16px 8px; font: 500 15px/1.3 var(--mono); letter-spacing: 0.02em; text-align: left; }
.scenario .no { color: var(--ink-dim); font-weight: 600; margin-right: 8px; }
.scenario .note { display: block; color: var(--ink-dim); font-size: 13px; font-weight: 400; margin-top: 2px; }

.chamber { margin: 16px 40px 0; background: var(--paper-raised); border: 1px solid var(--rule-strong); }
.chamber-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; padding: 20px 28px 14px; border-bottom: 1px solid var(--rule); }
.kicker { margin: 0 0 8px; font: 600 13px/1 var(--mono); text-transform: uppercase; letter-spacing: 0.2em; color: var(--ink-dim); }
.case-name { margin: 0; font: 600 35px/1.15 var(--serif); color: var(--ink); }
.case-meta { margin: 0; text-align: right; font: 400 14px/1.6 var(--mono); color: var(--ink-dim); white-space: nowrap; }
.chamber-grid { display: grid; grid-template-columns: 500px minmax(0, 1fr) 560px; min-height: 686px; }
.exhibit { padding: 22px 26px; border-right: 1px solid var(--rule); }
.exhibit-stampwrap { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; min-height: 58px; }
.exhibit-stamp { position: relative; display: inline-block; font: 600 20px/1 var(--serif); letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--seal); border: 2px solid var(--seal); padding: 11px 16px 10px; transform: rotate(-4deg); }
.exhibit-stamp::after { content: ''; position: absolute; inset: 3px; border: 1px solid var(--seal); }
.exhibit-stampnote { font: 400 13px/1.5 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-dim); max-width: 250px; }

table.ruled { width: 100%; border-collapse: collapse; }
table.ruled th, table.ruled td { border-bottom: 1px solid var(--rule); padding: 6px 10px 5px 0; text-align: left; vertical-align: top; }
table.ruled tr:last-child th, table.ruled tr:last-child td { border-bottom: 0; }
table.ruled th { width: 150px; font: 500 13px/1.5 var(--mono); text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-dim); font-weight: 500; }
table.ruled td { font: 400 16px/1.5 var(--mono); color: var(--ink); overflow-wrap: anywhere; }
.ok { color: var(--verdict-execute); font-weight: 500; }
.bad { color: var(--verdict-reject); font-weight: 500; }
.hint { font: 400 14px/1.6 var(--mono); color: var(--ink-dim); overflow-wrap: anywhere; margin: 8px 0; }
.proof-checks { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--rule-strong);
  font: 500 14px/1.6 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }
.proof-checks .ok { color: var(--verdict-execute); }
.evlink { color: var(--link); }

.ballots { padding: 22px 26px; min-width: 0; }
.ballot .why { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.round + .round { margin-top: 20px; }
.round-h { margin: 0 0 8px; display: flex; justify-content: space-between; align-items: baseline; gap: 14px; flex-wrap: wrap;
  font: 600 14px/1.3 var(--mono); text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink);
  border-bottom: 1px solid var(--rule-strong); padding-bottom: 6px; }
.round-box { font-weight: 400; color: var(--ink-dim); letter-spacing: 0.04em; text-transform: none; }
.round-box.swap { min-width: 380px; text-align: right; white-space: nowrap; }
.ballotlist { min-height: 24px; }
.ballot { padding: 9px 0 8px; border-bottom: 1px solid var(--rule); }
.ballot:last-child { border-bottom: 0; }
.ballot-head { display: flex; align-items: baseline; gap: 14px; }
.ballot .who { font: 500 17px/1.4 var(--mono); color: var(--ink); }
.ballot .what { margin-left: auto; font: 600 17px/1.4 var(--mono); letter-spacing: 0.05em; white-space: nowrap; }
.ballot .what.APPROVE { color: var(--verdict-execute); }
.ballot .what.DENY { color: var(--verdict-reject); }
.ballot .flip { font: 600 12px/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); border: 1px solid var(--ink-dim); padding: 3px 7px 2px; white-space: nowrap; }
.ballot-sub { display: flex; justify-content: space-between; gap: 18px; margin-top: 2px; }
.ballot .why { font: 400 17px/1.5 var(--mono); color: var(--ink-dim); } /* P0-4: evidence scale */
.ballot .sig { font: 400 15px/1.6 var(--mono); color: var(--ink-dim); white-space: nowrap; }
.empty { margin: 8px 0; font: 400 15px/1.5 var(--mono); color: var(--ink-dim); font-style: italic; }

.outcome { padding: 22px 26px; border-left: 1px solid var(--rule); }
.verdict { margin: 0; font: 700 44px/1.15 var(--serif); letter-spacing: 0.02em; color: var(--ink-dim); font-style: italic; }
.verdict.EXECUTE, .verdict.REJECT { font-style: normal; }
.verdict.EXECUTE { color: var(--verdict-execute); }
.verdict.REJECT { color: var(--verdict-reject); }
.tally { margin: 6px 0 16px; min-height: 46px; font: 500 14px/1.6 var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-dim);
  border-bottom: 1px solid var(--rule-strong); padding-bottom: 12px; }
.certificate { position: relative; }
.cert-doc { border: 1px solid var(--rule-strong); padding: 20px 20px 16px; background: var(--paper); }
.cert-h { margin: 0 0 12px; font: 600 17px/1.3 var(--serif); letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink);
  text-align: center; padding-bottom: 10px; border-bottom: 1px solid var(--rule); }
.cert-table th { width: 128px; }
.cert-table td { font-size: 15px; }
.cert-sealrow { display: flex; align-items: center; gap: 18px; margin-top: 16px; }
.seal { width: 148px; height: 148px; flex: 0 0 auto; color: var(--seal); transform: rotate(-8deg); }
.seal-caption { display: flex; flex-direction: column; gap: 7px; max-width: 660px; }
  .seal-word { margin: 0; font: 600 21px var(--serif); letter-spacing: 0.28em; color: var(--seal); }
  .seal-micro { margin: 0; font: 500 12px var(--mono); letter-spacing: 0.18em; color: var(--ink-dim); }
.seal-center { font: 700 26px var(--serif); letter-spacing: 1.2px; fill: currentColor; text-anchor: middle; }
.seal-sub { font: 500 10px var(--mono); letter-spacing: 3.4px; fill: currentColor; text-anchor: middle; }
.enforcement { margin: 0; font: 500 13px/1.6 var(--mono); color: var(--ink); }

/* ============ DETAIL VIEWS — deliberate cuts; the claim's component becomes the subject ============ */
.detail-col { position: absolute; left: 120px; right: 120px; top: 120px; bottom: 60px; }
.detail-col.wide { left: 80px; right: 80px; }
.detail-col.centered { display: flex; flex-direction: column; justify-content: center; padding-bottom: 40px; }
.case-strip { margin: 0 0 18px; font: 600 15px/1.4 var(--mono); letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim);
  border-bottom: 1px solid var(--rule); padding-bottom: 12px; }
.detail-h { margin: 0 0 10px; font: 600 56px/1.15 var(--serif); color: var(--ink); }

.cert-detail { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.cert-detail .case-strip { position: absolute; left: 0; right: 0; top: 0; margin: 0; }
.cert-doc.big { width: 1120px; padding: 38px 42px 30px; }
.cert-doc.big .cert-h { font-size: 26px; }
.cert-doc.big .cert-table th { width: 220px; font-size: 16px; }
.cert-doc.big .cert-table td { font-size: 21px; }
.cert-doc.big .cert-table th, .cert-doc.big .cert-table td { padding: 9px 12px 8px 0; }
.cert-decision-big { font-weight: 600; letter-spacing: 0.05em; font-size: 26px; }
.big-seal { width: 265px; height: 265px; }
.cert-doc.big .seal-word { font-size: 26px; }
  .cert-doc.big .seal-micro { font-size: 14px; }
.cert-doc.big .seal-center { font-size: 40px; }
.reject-plate { text-align: center; padding: 56px 40px 48px; border-top: 3px solid var(--rule-strong); border-bottom: 3px solid var(--rule-strong); }
.reject-word { margin: 0 0 26px; font: 700 128px/1 var(--serif); letter-spacing: 0.08em; color: var(--verdict-reject); }
.reject-line { margin: 8px 0 0; font: 500 22px/1.5 var(--mono); color: var(--ink); letter-spacing: 0.04em; }
.close-strip { position: absolute; left: 24px; right: 24px; bottom: 34px; z-index: 40; display: flex; align-items: baseline; justify-content: space-between; gap: 28px; padding: 14px 18px 12px; border-top: 2px solid var(--rule-strong); background: var(--paper-raised); }
.brand-seal { width: 34px; height: 34px; vertical-align: -9px; margin-right: 10px; }
  .masthead-seal { width: 30px; height: 30px; vertical-align: -8px; margin-right: 12px; }
  .close-brandline { font: 700 26px var(--serif); color: var(--ink); }
.close-brandline .brand-mark { color: var(--ink); margin-right: 6px; }
.close-thesis { font: 500 17px/1.4 var(--mono); color: var(--ink-dim); letter-spacing: 0.03em; }
.close-tail-sub { font: 400 12px var(--mono); color: var(--ink-faint); letter-spacing: 0.08em; white-space: nowrap; }
.cert-detail .cert-doc.big { width: 1380px; padding: 46px 54px 36px; }
.cert-detail .case-strip { font-size: 15px; }
.cert-doc.big .seal-sub { font-size: 15px; letter-spacing: 5px; }
.big-enf { font-size: 17px; letter-spacing: 0.02em; max-width: 640px; }

.big-ballot { border: 1px solid var(--rule-strong); background: var(--paper-raised); padding: 34px 38px; margin: 30px 0 0; }
.big-ballot .who { font-size: 32px; }
.big-ballot .what { font-size: 32px; }
.big-ballot .flip { font-size: 17px; }
.big-ballot .why { font-size: 22px; line-height: 1.6; }
.big-ballot .sig { font-size: 18px; }
.dissent-others { margin: 26px 0 0; font: 400 20px/1.6 var(--mono); color: var(--ink-dim); }
.dissent-block { margin: 28px 0 0; font: 600 26px/1.5 var(--mono); letter-spacing: 0.04em; text-transform: uppercase; }

.big-table th, .big-table td { font-size: 20px; padding: 14px 18px 12px 0; }
.big-table thead th { font-size: 15px; }
.openrow { font: 600 18px/1.5 var(--mono); letter-spacing: 0.08em; color: var(--ink); }

.pd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; }
.sub-h { margin: 0 0 10px; font: 600 16px/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink-dim); }
.small-table th { width: 190px; font-size: 16px; }   /* P0-4: trace labels at evidence scale */
.small-table td { font-size: 17px; }

.sig-row { border-bottom: 1px solid var(--rule); padding: 18px 0 16px; }
.sig-row .who { font: 500 24px/1.4 var(--mono); color: var(--ink); }
.sig-row .what { margin-left: auto; font: 600 24px/1.4 var(--mono); letter-spacing: 0.05em; }
.sig-row .what.APPROVE { color: var(--verdict-execute); }
.sig-row .what.DENY { color: var(--verdict-reject); }
.sig-full { font: 400 16px/1.7 var(--mono); color: var(--ink-dim); overflow-wrap: anywhere; margin-top: 6px; }

.rawbytes { border: 1px solid var(--rule); background: var(--paper-raised); }
.rawbytes summary { display: block; padding: 18px 22px; font: 500 18px/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--ink-dim); border-bottom: 1px solid var(--rule); }
.bytes { margin: 0; padding: 22px; overflow: hidden;
  font: 400 20px/1.7 var(--mono); color: var(--ink-dim); word-break: break-all; white-space: pre-wrap; } /* P0-4: fills the canvas */

/* ============ HOOK + CLOSE (QP serif voice on paper) ============ */
.hook-block { position: absolute; left: 140px; right: 200px; top: 76px; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 30px; }
.hook-line { margin: 0; font: 600 62px/1.18 var(--serif); color: var(--ink); max-width: 1500px; }
.hook-line.personal { font: 500 40px/1.3 var(--serif); font-style: italic; color: var(--ink-dim); }
.close-plate { position: absolute; inset: 76px 0 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; text-align: center; }
.close-brand { display: flex; align-items: baseline; gap: 18px; }
.close-brand .brand-mark { font-size: 64px; }
.close-line { margin: 0; font: 600 46px/1.3 var(--serif); color: var(--ink); }
.close-sub { margin: 0; font: 400 18px/1.7 var(--mono); letter-spacing: 0.06em; color: var(--ink-dim); }
.close-credit { margin-top: 22px; font: 400 12px/1 var(--kymono); letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); }

.roster-table th { width: 260px; padding-top: 14px; padding-bottom: 14px; }
.roster-table td { font-size: 20px; padding-top: 14px; padding-bottom: 14px; }
.roster-table .hint { font-size: 16px; margin: 6px 0 0; }
.roster-table { margin-top: 18px; }
</style>
</head>
<body>
<div id="master" data-composition-id="master" data-width="1920" data-height="1080" data-duration="125.66" data-fps="30">

  <!-- CHROME (persistent, subordinate) -->
  <header id="chrome">
    <span class="sys"><img class="ky-mark" src="assets/kyanitelabs-mark.png" alt="" width="26" height="26">KYANITE LABS / QUORUMPROOF</span>
    <span class="state">
      <span class="on" id="st1">01 · THE PROBLEM</span>
      <span id="st2">02 · LIVE PROOF</span>
      <span id="st3">03 · THE FLEET</span>
      <span id="st4">04 · AUDIT TRAIL</span>
      <span id="st5">05 · CLOSE</span>
    </span>
  </header>
  <div id="progress"><span id="progress-fill"></span></div>

  <!-- V1 · HOOK 0 → 10.1 -->
  <section class="view clip" id="v-hook" data-start="0" data-duration="10.1">
    <div class="hook-block">
      <p class="hook-line mv" id="hk1">AI agents are about to move money on-chain.</p>
      <p class="hook-line mv" id="hk2">One agent is just one confident voice holding the keys.</p>
      <p class="hook-line personal mv" id="hk3">I’m not okay with that.</p>
    </div>
  </section>

  <!-- V2 · DASHBOARD AT REST 10.1 → 21.33 (no seal on the empty certificate) -->
  <section class="view clip" id="v-rest" data-start="10.1" data-duration="11.2333">
    <div class="app-page">
      ${masthead()}
      <section class="chamber">${chamber('awaiting', 'rst-')}</section>
    </div>
  </section>

  <!-- V3 · TERMINAL — real verify-live capture; starts 1.5s early UNDER the rest view -->
  <video class="clip" id="v-term" data-start="${TERM_START}" data-duration="${TERM_DUR}" data-media-start="0"
         src="assets/terminal-verify-live.mp4" muted playsinline preload="auto"
         style="position:absolute; inset:0; width:1920px; height:1080px; object-fit:cover; z-index:0;"></video>
  <img class="clip" id="v-term-hold" data-start="${(TERM_END - 0.0333).toFixed(4)}" data-duration="${(48.8333 - TERM_END + 0.0333).toFixed(4)}" src="assets/terminal-hold.png"
       style="position:absolute; inset:0; width:1920px; height:1080px; object-fit:cover; z-index:1;"/>

  <!-- V4 · FLEET ROSTER 48.83 → 56.0 -->
  <section class="view clip" id="v-roster" data-start="48.8333" data-duration="7.1667">${rosterView()}</section>

  <!-- V5 · CHAMBER QP-001 — exhibit → secret ballots → reveal → quorum → verdict 56.0 → 66.2 -->
  <section class="view clip" id="v-ch1" data-start="56.0" data-duration="10.2">
    <div class="app-page">
      ${masthead()}
      <section class="chamber">${chamber(case1, 'c1-')}</section>
    </div>
  </section>

  <!-- V6 · CERTIFICATE CLOSE-UP QP-001 — the earned seal 66.2 → 70.2 -->
  <section class="view clip" id="v-cert" data-start="66.2" data-duration="4.0">${certView(case1, null, 'v-cert')}</section>

  <!-- V7 · CHAMBER QP-002 — secret ballots → reveal → dissent → REJECT 70.2 → 90.4 -->
  <section class="view clip" id="v-ch2" data-start="70.2" data-duration="20.2">
    <div class="app-page">
      ${masthead()}
      <section class="chamber">${chamber(case2, 'c2-')}</section>
    </div>
  </section>

  <!-- V7b · REJECT VERDICT CLOSE-UP QP-002 90.4 → 93.4 -->
  <section class="view clip dark" id="v-reject" data-start="90.4" data-duration="3.0">${rejectView(case2)}</section>

  <!-- V8 · DISSENT CLOSE-UP QP-002 93.4 → 98.4 -->
  <section class="view clip dark" id="v-dissent" data-start="93.4" data-duration="4.1">${dissentView(case2)}</section>

  <!-- V9 · SIGNED BALLOTS 94.4 → 99.0 -->
  <section class="view clip dark" id="v-sigs" data-start="96.7" data-duration="4.0">${sigsView(case1)}</section>

  <!-- V10 · FACT & PROOF DETAIL 99.0 → 104.0 -->
  <section class="view clip dark" id="v-proof" data-start="100.7" data-duration="4.6">${proofView(case1)}</section>

  <!-- V11 · RAW PROOF BYTES 104.0 → 108.5 -->
  <section class="view clip dark" id="v-bytes" data-start="105.3" data-duration="4.4">${bytesView(case1)}</section>

  <!-- V12 · DOCKET 108.5 → 112.9 -->
  <section class="view clip dark" id="v-docket" data-start="109.7" data-duration="4.0">${docketView()}</section>

  <!-- V13 · THE EARNED CERTIFICATE — final subject, held through the last narration line 115.0 → 124.78 -->
  <section class="view clip" id="v-cert2" data-start="113.7" data-duration="11.96">
    ${certView(case1, 'THE SEALED DECISION — CERTIFICATE OF QUORUM', 'v-cert2')}
    <div class="close-strip mv" id="cl-strip">
      <span class="close-brandline"><img class="ky-mark" src="assets/kyanitelabs-mark.png" alt="" width="30" height="30">${SEAL_SVG('brand-seal', null, 'sealarc-brand')} QuorumProof</span>
      <span class="close-thesis">The fleet replaces the oracle. The paper trail is the product.</span>
      <span class="close-tail-sub">BUIDL CTC 2026 Fall · AI track · Edited with Kinocut</span>
    </div>
  </section>






    <!-- subtitle layer: script-verbatim captions (deterministic: script + silence measurement) -->
    <div class="cap" id="cap-0">Here's the problem — AI agents are about to move money on-chain, and one agent is just one confident voice holding the keys.</div>
    <div class="cap" id="cap-1">I'm not okay with that.</div>
    <div class="cap" id="cap-2">QuorumProof is a fleet — no single agent can move value alone.</div>
    <div class="cap" id="cap-3">Every decision needs a quorum, and the fact they argue over is verified by Creditcoin itself.</div>
    <div class="cap" id="cap-4">Not an oracle operator in the middle — the chain itself.</div>
    <div class="cap top" id="cap-5">Look at this — it's a real run, not a mock.</div>
    <div class="cap top" id="cap-6">That's a real Ethereum mainnet transaction, 3.6 ETH.</div>
    <div class="cap top" id="cap-7">Attestcoin proves it inside Creditcoin's own trust domain — build the proof, verify it with the BlockProver precompile on CC3 testnet, decode it on-chain into a structured fact.</div>
    <div class="cap top" id="cap-8">And it's all reads — zero tokens, zero keys.</div>
    <div class="cap" id="cap-9">I don't need to spend anything to prove a fact.</div>
    <div class="cap" id="cap-10">Now the fleet.</div>
    <div class="cap" id="cap-11">Three agents, three mandates — not three copies of the same model.</div>
    <div class="cap" id="cap-12">The underwriter wants exact policy fit.</div>
    <div class="cap top" id="cap-13">The fraud hunter asks one question: is this transaction real?</div>
    <div class="cap top" id="cap-14">The market analyst reads partial repayments.</div>
    <div class="cap top" id="cap-15">Round one is a secret ballot — everyone commits before anyone sees a vote.</div>
    <div class="cap" id="cap-16">Round two is debate, and each agent can revise once.</div>
    <div class="cap" id="cap-17">Watch the repayment case — three out of three, EXECUTE — the certificate's sealed, every ballot signature verified.</div>
    <div class="cap" id="cap-18">Now an unrelated inflow — watch the split.</div>
    <div class="cap" id="cap-19">The fraud hunter says yes — the transaction's real, its integrity check passes.</div>
    <div class="cap" id="cap-20">The other two say no on policy: this isn't a repayment.</div>
    <div class="cap" id="cap-21">One out of three.</div>
    <div class="cap" id="cap-22">REJECT.</div>
    <div class="cap" id="cap-23">The quorum blocks it, and the sole dissent is right there on the record — that's the product working.</div>
    <div class="cap" id="cap-24">Every ballot's signed with the agent's own secp256k1 key and bound to the Attestcoin fact hash.</div>
    <div class="cap" id="cap-25">On-chain, the QuorumRegistry contract recovers every signature and applies the quorum gate — two of three.</div>
    <div class="cap" id="cap-26">Deploy it, and the decision becomes a Creditcoin fact — one any lending protocol can consume.</div>
    <div class="cap" id="cap-27">QuorumProof — auditable autonomous decisions on the Attestcoin Protocol.</div>
    <div class="cap" id="cap-28">The fleet replaces the oracle — and the paper trail is the product.</div>
</div>
<script src="assets/gsap.min.js"></script>
<script>
/* QP-VIDEO-v3.1 authored motion — GSAP only. Zero zoompan/ken-burns anywhere.
   Ballot place 180ms ease-out · stamp 250ms ease-out (DESIGN-SYSTEM motion contract).
   Clock: narration onsets 0.8/22.84/48.82/98.42/116.78 (voice-lane truth, program mix
   124.78s — script v2.2 honesty clause); beats re-timed to the new mix. */
const tl = gsap.timeline({ paused: true });
const E_OUT = 'power3.out';
const up = (id, t, d, y) => tl.fromTo(id, { opacity: 0, y: y || 14 }, { opacity: 1, y: 0, duration: d || 0.5, ease: E_OUT }, t);
const place = (id, t) => tl.fromTo(id, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }, t); /* ballot placement, 180ms */
const stamp = (id, t) => tl.fromTo(id, { opacity: 0, scale: 1.18 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }, t); /* 250ms stamp */
const fade = (id, t, d) => tl.fromTo(id, { opacity: 0 }, { opacity: 1, duration: d || 0.4, ease: 'power2.out' }, t);

/* chrome: masthead settles in; progress fills over the full runtime (linear, 121.5s) */
tl.fromTo('#chrome', { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: E_OUT }, 0.1);
tl.fromTo('#progress-fill', { width: '0%' }, { width: '100%', duration: 125.66, ease: 'none' }, 0);

/* chapter state swaps — hard kills for seek safety */
tl.to('#st1', { opacity: 0, duration: 0.001 }, 21.32); tl.set('#st1', { opacity: 0 }, 21.3333); tl.set('#st2', { opacity: 1 }, 21.3333);
tl.to('#st2', { opacity: 0, duration: 0.001 }, 48.82); tl.set('#st2', { opacity: 0 }, 48.8333); tl.set('#st3', { opacity: 1 }, 48.8333);
tl.to('#st3', { opacity: 0, duration: 0.001 }, 96.69); tl.set('#st3', { opacity: 0 }, 96.7); tl.set('#st4', { opacity: 1 }, 96.7);
tl.to('#st4', { opacity: 0, duration: 0.001 }, 113.69); tl.set('#st4', { opacity: 0 }, 113.7); tl.set('#st5', { opacity: 1 }, 113.7);

/* V1 hook — lines land on the narration clock (1.09/8.41), then clear for the product */
up('#hk1', 1.05, 0.7, 26);
up('#hk2', 4.3, 0.7, 26);
up('#hk3', 8.4, 0.6, 18);
tl.to(['#hk1', '#hk2', '#hk3'], { opacity: 0, y: -14, duration: 0.4, ease: 'power2.in', stagger: 0.05 }, 9.65);
tl.set(['#hk1', '#hk2', '#hk3'], { opacity: 0 }, 10.1);

/* V2 dashboard at rest — the product shell assembles, then holds (cert stays empty, unsealed) */
up('#v-rest .masthead', 10.5, 0.5);
up('#v-rest .clerk', 10.65, 0.5);
up('#v-rest .chamber', 10.8, 0.5);
stamp('#rst-exstamp', 11.2);

/* V4 roster — the fleet, named on the narration (48.98 → 57.9) */
up('#v-roster .case-strip', 49.0, 0.45);
up('#v-roster .detail-h', 49.1, 0.45);
up('#v-roster .hint', 49.25, 0.4);
up('#ros0', 49.8, 0.45, 12);
up('#ros1', 50.9, 0.45, 12);
up('#ros2', 52.0, 0.45, 12);

/* V5 QP-001 — exhibit → Round I secret → REVEAL → Round II → quorum → verdict */
up('#v-ch1 .masthead', 56.1, 0.45);
up('#v-ch1 .clerk', 56.2, 0.45);
up('#v-ch1 .chamber', 56.3, 0.45);
stamp('#c1-exstamp', 56.7);
tl.fromTo('#v-ch1 .exr', { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out', stagger: 0.08 }, 56.9);
fade('#c1-proofchecks', 57.3);
/* Round I — commitment: ballots place WITHOUT vote content (secrecy window) */
place('#c1-r1b0', 58.0); place('#c1-r1b1', 58.4); place('#c1-r1b2', 58.8);
/* Round II reveal at 59.63 ("Round two is debate…"): box-open caption + votes land together */
tl.to('#v-ch1 .round-h .swap > span.on', { opacity: 0, duration: 0.001 }, 59.62);
tl.set('#v-ch1 .round-h .swap > span:not(.on)', { opacity: 1 }, 59.63);
tl.fromTo('#v-ch1 .sec', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power2.out', stagger: 0.06 }, 59.63);
/* Round II — debate ballots place */
place('#c1-r2b0', 60.0); place('#c1-r2b1', 60.5); place('#c1-r2b2', 61.0);
/* quorum line lands ONLY at N≥2 (BLOCKER-1 gate), then counts to 3 ("three out of three" 62.62→) */
tl.to('#v-ch1 .tally.swap > span.on', { opacity: 0, duration: 0.001 }, 63.55);
tl.set('#v-ch1 .tally.swap > span:not(.on)', { opacity: 1 }, 63.6); /* shows "QUORUM MET — 3/3" (digit pre-advanced) */
tl.set('#c1-digits > span:nth-child(1)', { opacity: 0 }, 63.58); tl.set('#c1-digits > span:nth-child(2)', { opacity: 1 }, 63.58); /* digit=3 in the same frame MET lands */
/* verdict stamp — the ceremony, 250ms */
tl.to('#v-ch1 .verdict-swap > p.on', { opacity: 0, duration: 0.001 }, 65.35);
tl.fromTo('#v-ch1 .verdict-swap > p.EXECUTE, #v-ch1 .verdict-swap > p.REJECT', { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }, 65.4);

/* V6 certificate close-up — the earned seal; the certificate ISSUES here */
up('#v-cert .case-strip', 66.35, 0.4);
up('#v-cert .cert-doc', 66.45, 0.5, 16);
tl.fromTo('#v-cert tbody tr.mv', { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out', stagger: 0.12 }, 66.7);
stamp('#v-cert .big-seal', 67.6);
fade('#v-cert .big-enf', 67.55);

/* V7 QP-002 — exhibit → Round I secret → reveal → revised dissent → REJECT */
up('#v-ch2 .masthead', 70.3, 0.45);
up('#v-ch2 .clerk', 70.4, 0.45);
up('#v-ch2 .chamber', 70.5, 0.45);
stamp('#c2-exstamp', 70.9);
tl.fromTo('#v-ch2 .exr', { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out', stagger: 0.08 }, 71.1);
fade('#c2-proofchecks', 71.5);
/* Round I — secret commitment (no vote content) */
place('#c2-r1b0', 72.4); place('#c2-r1b1', 72.8); place('#c2-r1b2', 73.2);
/* Round II reveal at 76.7 ("The fraud hunter says yes…" = the box opening) */
tl.to('#v-ch2 .round-h .swap > span.on', { opacity: 0, duration: 0.001 }, 76.69);
tl.set('#v-ch2 .round-h .swap > span:not(.on)', { opacity: 1 }, 76.7);
tl.fromTo('#v-ch2 .sec', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power2.out', stagger: 0.06 }, 76.7);
place('#c2-r2b0', 76.9); place('#c2-r2b1', 77.5); place('#c2-r2b2', 78.1); /* the revised ballot places at 77.5 */
/* "One out of three, reject" (86.97→): quorum NOT MET line + verdict stamp */
tl.to('#v-ch2 .tally.swap > span.on', { opacity: 0, duration: 0.001 }, 87.35);
tl.set('#v-ch2 .tally.swap > span:not(.on)', { opacity: 1 }, 87.4);
tl.to('#v-ch2 .verdict-swap > p.on', { opacity: 0, duration: 0.001 }, 87.30);
tl.fromTo('#v-ch2 .verdict-swap > p.REJECT, #v-ch2 .verdict-swap > p.EXECUTE', { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }, 87.31);

/* V8 dissent close-up ("the sole dissent is right there on the record") */
up('#v-dissent .case-strip', 90.55, 0.4);
up('#v-dissent .big-ballot', 90.7, 0.5, 16);
fade('#v-dissent .dissent-others', 91.6);
fade('#v-dissent .dissent-block', 92.6);

/* V9 signed ballots ("Every ballot is signed… secp256k1" 94.85→) */
up('#v-sigs .case-strip', 96.85, 0.4);
fade('#v-sigs .hint', 97.1, 0.35);
tl.fromTo(['#sg0', '#sg1', '#sg2'], { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: E_OUT, stagger: 0.3 }, 95.0);

/* V10 fact & proof detail */
up('#v-proof .case-strip', 100.85, 0.4);
tl.fromTo('#v-proof tr.mv', { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out', stagger: 0.07 }, 101.1);

/* V11 raw bytes (large type, filled canvas, stationary single page) */
up('#v-bytes .case-strip', 105.45, 0.4);
up('#v-bytes .rawbytes', 105.65, 0.5, 14);

/* V12 docket ("The decision becomes a Creditcoin fact…") */
up('#v-docket .case-strip', 109.85, 0.4);
tl.fromTo('#v-docket tbody tr', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: E_OUT, stagger: 0.35 }, 110.1);
fade('#v-docket .hint', 111.8);

/* V7b REJECT verdict — QP-002 focal payoff (stamp class) */
stamp('#v-reject .reject-plate', 90.55);
fade('#v-reject .case-strip', 90.4, 0.35);

/* V8 dissent close-up */
up('#v-dissent .case-strip', 93.45, 0.35);
up('#v-dissent .big-ballot', 93.6, 0.45, 12);
fade('#v-dissent .dissent-others', 94.4, 0.4);
fade('#v-dissent .dissent-block', 95.4, 0.45);

/* V13 the earned certificate — FINAL SUBJECT, held through the last narration line */
up('#v-cert2 .case-strip', 113.75, 0.4);
up('#v-cert2 .cert-doc', 113.9, 0.5, 16);
tl.fromTo('#v-cert2 tbody tr.mv', { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'power2.out', stagger: 0.1 }, 114.15);
stamp('#v-cert2 .big-seal', 116.8);
fade('#v-cert2 .big-enf', 117.6);
tl.fromTo('#cl-strip', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out' }, 120.7);





/* subtitle beats */
tl.fromTo('#cap-0', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 0.8);
tl.set('#cap-0', { opacity: 0 }, 8.0);
tl.fromTo('#cap-1', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 8.0);
tl.set('#cap-1', { opacity: 0 }, 9.57);
tl.fromTo('#cap-2', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 9.57);
tl.set('#cap-2', { opacity: 0 }, 13.33);
tl.fromTo('#cap-3', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 13.33);
tl.set('#cap-3', { opacity: 0 }, 18.34);
tl.fromTo('#cap-4', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 18.34);
tl.set('#cap-4', { opacity: 0 }, 21.78);
tl.fromTo('#cap-5', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 23.18);
tl.set('#cap-5', { opacity: 0 }, 27.02);
tl.fromTo('#cap-6', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 27.02);
tl.set('#cap-6', { opacity: 0 }, 29.82);
tl.fromTo('#cap-7', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 29.82);
tl.set('#cap-7', { opacity: 0 }, 39.6);
tl.fromTo('#cap-8', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 39.6);
tl.set('#cap-8', { opacity: 0 }, 42.75);
tl.fromTo('#cap-9', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 42.75);
tl.set('#cap-9', { opacity: 0 }, 46.24);
tl.fromTo('#cap-10', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 47.64);
tl.set('#cap-10', { opacity: 0 }, 48.73);
tl.fromTo('#cap-11', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 48.73);
tl.set('#cap-11', { opacity: 0 }, 53.08);
tl.fromTo('#cap-12', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 53.08);
tl.set('#cap-12', { opacity: 0 }, 55.26);
tl.fromTo('#cap-13', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 55.26);
tl.set('#cap-13', { opacity: 0 }, 58.89);
tl.fromTo('#cap-14', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 58.89);
tl.set('#cap-14', { opacity: 0 }, 61.06);
tl.fromTo('#cap-15', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 61.06);
tl.set('#cap-15', { opacity: 0 }, 66.14);
tl.fromTo('#cap-16', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 66.14);
tl.set('#cap-16', { opacity: 0 }, 69.77);
tl.fromTo('#cap-17', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 69.77);
tl.set('#cap-17', { opacity: 0 }, 76.3);
tl.fromTo('#cap-18', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 76.3);
tl.set('#cap-18', { opacity: 0 }, 79.2);
tl.fromTo('#cap-19', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 79.2);
tl.set('#cap-19', { opacity: 0 }, 83.92);
tl.fromTo('#cap-20', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 83.92);
tl.set('#cap-20', { opacity: 0 }, 87.91);
tl.fromTo('#cap-21', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 87.91);
tl.set('#cap-21', { opacity: 0 }, 89.36);
tl.fromTo('#cap-22', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 89.36);
tl.set('#cap-22', { opacity: 0 }, 89.73);
tl.fromTo('#cap-23', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 89.73);
tl.set('#cap-23', { opacity: 0 }, 96.62);
tl.fromTo('#cap-24', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 98.02);
tl.set('#cap-24', { opacity: 0 }, 104.1);
tl.fromTo('#cap-25', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 105.01);
tl.set('#cap-25', { opacity: 0 }, 110.77);
tl.fromTo('#cap-26', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 111.72);
tl.set('#cap-26', { opacity: 0 }, 116.66);
tl.fromTo('#cap-27', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 118.06);
tl.set('#cap-27', { opacity: 0 }, 122.32);
tl.fromTo('#cap-28', { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power1.out' }, 123.26);
tl.set('#cap-28', { opacity: 0 }, 126.46);

window.__timelines = { master: tl };
</script>
</body>
</html>
`;

writeFileSync(join(here, 'hyperframes', 'index.html'), html);
console.log('QP-VIDEO-v3.1 build: hyperframes/index.html written,', (html.length / 1024).toFixed(1) + ' KiB');
