/* QuorumProof dashboard — dependency-free. Institutional-ledger UI (DESIGN-SYSTEM.md).
   The Chamber: exhibit → ballots → quorum → sealed certificate. */
const $ = (id) => document.getElementById(id);

let scenarios = [];
let scenarioNames = new Map();
let docket = [];            // { no, label, data } — session docket, latest last
let currentNo = null;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const weiToEth = (hexwei) => (Number(BigInt(hexwei)) / 1e18).toLocaleString('en-US', { maximumFractionDigits: 8 });
const short = (s, n = 10) => (s ? s.slice(0, n + 2) + '…' + (s.length > n + 4 ? s.slice(-4) : '') : '');
const fmtInt = (n) => Number(n).toLocaleString('en-US');

/* ---------- clerk's desk ---------- */
function renderScenarios() {
  $('scenarios').innerHTML = scenarios.map((s, i) => `
    <button type="button" class="scenario" data-i="${i}">
      <span class="no">No.&nbsp;${i + 1}</span>${esc(s.name)}
      <span class="note">${esc(short(s.txHash, 6))} — ${esc(s.note)}</span>
    </button>`).join('');
  document.querySelectorAll('.scenario').forEach((b) =>
    b.addEventListener('click', () => assess(scenarios[Number(b.dataset.i)].txHash, scenarios[Number(b.dataset.i)].name, b)));
}

async function loadHealth() {
  try {
    const r = await fetch('/api/health');
    const h = await r.json();
    $('netdot').classList.add('live');
    $('nettext').textContent = `CC3 TESTNET · BLOCK ${fmtInt(h.cc3Block)} · MAINNET ATTESTED TO ${fmtInt(h.attestedHeights.ethereumMainnet)}`;
    $('foot-status').textContent = `CC3 block ${fmtInt(h.cc3Block)} · attested heights: eth-mainnet ${fmtInt(h.attestedHeights.ethereumMainnet)} · eth-sepolia ${fmtInt(h.attestedHeights.ethereumSepolia)}`;
    const p = h.policy;
    $('policydl').querySelector('tbody').innerHTML = `
      <tr><th>lender</th><td>${esc(short(p.lender, 16))}</td></tr>
      <tr><th>obligation</th><td>${weiToEth(p.expectedAmountWei)} ETH</td></tr>
      <tr><th>tolerances</th><td>shortfall ${p.shortfallToleranceBps / 100}% · overpay ${p.overpayToleranceBps / 100}%</td></tr>
      <tr><th>dust floor</th><td>${weiToEth(p.minAmountWei)} ETH</td></tr>`;
    scenarios = h.scenarios;
    scenarios.forEach((s) => scenarioNames.set(s.txHash, s.name));
    renderScenarios();
  } catch {
    $('netdot').classList.add('dead');
    $('nettext').textContent = 'CC3 TESTNET UNREACHABLE';
  }
}

/* ---------- the chamber ---------- */
function exhibitRows(f) {
  return `
    <tr><th>factHash</th><td>${esc(short(f.factHash, 20))}</td></tr>
    <tr><th>source tx</th><td>${esc(short(f.txHash, 14))}</td></tr>
    <tr><th>parties</th><td>${esc(short(f.from, 8))} → ${esc(short(f.to, 8))}</td></tr>
    <tr><th>value</th><td>${weiToEth('0x' + BigInt(f.valueWei).toString(16))} ETH</td></tr>
    <tr><th>position</th><td>chainKey ${f.chainKey} · block ${fmtInt(f.headerNumber)} · tx #${f.txIndex}</td></tr>
    <tr><th>receipt</th><td>status ${f.receiptStatus ?? '?'} · txType ${f.txType}</td></tr>
    <tr><th>attested to</th><td>${f.attestedHeight ? fmtInt(f.attestedHeight) : '—'} <span class="hint">(CC3 height at proof time)</span></td></tr>`;
}

function ballotRow(v, prev, i) {
  const changed = prev && (prev.vote !== v.vote || Math.abs(prev.confidence - v.confidence) > 1e-9);
  return `
    <div class="ballot" style="animation-delay:${i * 60}ms">
      <div class="ballot-head">
        <span class="who">${esc(v.agentId)}</span>
        ${changed ? '<span class="flip">revised</span>' : ''}
        <span class="what ${esc(v.vote)}">${esc(v.vote)} ${v.confidence.toFixed(2)}</span>
      </div>
      <div class="ballot-sub">
        <span class="why">${esc(v.reasons.join(' · '))}</span>
        <span class="sig">sig ${esc(short(v.signature, 8))}</span>
      </div>
    </div>`;
}

function meanConf(votes) {
  const a = votes.filter((v) => v.vote === 'APPROVE');
  return a.length ? a.reduce((s, v) => s + v.confidence, 0) / a.length : 0;
}

function renderChamber(entry) {
  const d = entry.data;
  const f = d.trace.fact;
  const c = d.trace.certificate;
  const r1 = d.trace.rounds[0].votes;
  const r2 = d.trace.rounds[1].votes;
  const t = d.trace.timings;
  const met = c.decision === 'EXECUTE';
  const q = c.quorum;

  $('case-name').textContent = entry.label;
  $('case-meta').innerHTML =
    `CASE No. QP-${new Date(c.createdAt).getFullYear()}-${String(entry.no).padStart(3, '0')} · CONVENED ${esc(c.createdAt)}` +
    `<br/>BOUND TO factHash ${esc(short(c.factHash, 10))} · ${esc(c.chain.toUpperCase())}`;

  $('exhibit-verifiedvia').textContent = `verified via ${f.verifiedVia}`;
  $('exhibit-table').querySelector('tbody').innerHTML = exhibitRows(f);
  $('proof-checks').innerHTML =
    `PROOF <span class="ok">VERIFIED</span> ${t.proofMs}MS · PRECOMPILE <span class="ok">PASS</span> ${t.verifyMs}MS · ` +
    `DECODE <span class="ok">PASS</span> ${t.decodeMs}MS · DELIBERATION ${t.deliberateMs}MS`;

  $('r1-box').textContent = 'votes sealed — box opened at round II';
  $('r2-box').textContent = `box ${esc(short(d.trace.ballotBoxHash, 8))}`;
  $('round1').innerHTML = r1.map((v, i) => ballotRow(v, null, i)).join('');
  $('round2').innerHTML = r2.map((v, i) => ballotRow(v, r1[i], i)).join('');

  const v = $('verdict');
  v.textContent = c.decision;
  v.className = 'verdict ' + c.decision;
  $('tally').textContent = met
    ? `QUORUM MET — ${q.approvals}/${q.fleetSize} APPROVALS · ≥${q.required} REQUIRED · MEAN CONFIDENCE ${meanConf(r2).toFixed(2)}`
    : `QUORUM NOT MET — ${q.approvals}/${q.fleetSize} APPROVALS · ≥${q.required} REQUIRED · ACTION BLOCKED, CERTIFICATE RECORDED`;

  const clean = d.submission.failures.length === 0;
  $('cert-decision').innerHTML = met ? '<span class="ok">EXECUTE — quorum met</span>' : '<span class="bad">REJECT — quorum not met</span>';
  $('cert-facthash').textContent = short(c.factHash, 12);
  $('cert-policyid').textContent = short(c.policyId, 12);
  $('certhash').textContent = short(c.certHash, 12);
  $('cert-ballots').innerHTML = `${c.votes.length} signed · audit ${clean ? '<span class="ok">clean</span>' : '<span class="bad">FAILED</span>'}`;
  $('cert-issued').textContent = c.createdAt;
  $('enforcement').textContent =
    `${d.submission.mode} enforcement — ${d.submission.note}` +
    (d.llmEnabled ? ' · LLM analyst enabled' : ' · deterministic fleet');
  const seal = $('seal');
  seal.style.animation = 'none';
  void seal.getBoundingClientRect(); // restart the stamp animation on each proceeding
  seal.style.animation = '';

  /* roster */
  $('roster').querySelector('tbody').innerHTML = d.fleetRoster.map((a) => `
    <tr><th>${esc(a.agentId)}</th><td>${esc(a.kind)} · ${esc(a.agentAddress)}<br/><span class="hint">${esc(a.charter)}</span></td></tr>`).join('');

  /* § 2 — fact & proof detail */
  $('pd-case').textContent = `— case QP-${new Date(c.createdAt).getFullYear()}-${String(entry.no).padStart(3, '0')}`;
  $('pd-fact').querySelector('tbody').innerHTML = `
    <tr><th>from</th><td>${esc(f.from)}</td></tr>
    <tr><th>to</th><td>${esc(f.to)}</td></tr>
    <tr><th>value</th><td>${weiToEth('0x' + BigInt(f.valueWei).toString(16))} ETH (${fmtInt(f.valueWei)} wei)</td></tr>
    <tr><th>txType</th><td>${f.txType}</td></tr>
    <tr><th>receipt status</th><td>${f.receiptStatus ?? '?'}</td></tr>
    <tr><th>calldata</th><td>${esc(f.calldata === '0x' ? '0x — none' : short(f.calldata, 20))}</td></tr>
    <tr><th>factHash preimage</th><td>keccak256(chainKey ++ headerNumber ++ txHash ++ verified)</td></tr>`;
  const art = f.proofArtifacts;
  $('pd-trace').querySelector('tbody').innerHTML = `
    <tr><th>verification</th><td><span class="ok">${esc(f.verifiedVia)}</span></td></tr>
    <tr><th>proof build</th><td>${t.proofMs} ms — hosted Attestcoin Proof Builder (testnet)</td></tr>
    <tr><th>precompile verify</th><td>${t.verifyMs} ms — verifySingle() staticCall against 0x…FD2</td></tr>
    <tr><th>on-chain decode</th><td>${t.decodeMs} ms — EvmV1Decoder 0x731c…49f9f (eth_call)</td></tr>
    <tr><th>merkle root</th><td>${art ? esc(short(art.merkleRoot, 16)) : '—'}</td></tr>
    <tr><th>merkle siblings</th><td>${art ? `${art.merkleSiblings.length} entries` : '—'}</td></tr>
    <tr><th>continuity</th><td>${art ? `lower-endpoint ${esc(short(art.continuity.lowerEndpointDigest, 8))} · ${art.continuity.roots.length} roots` : '—'}</td></tr>
    <tr><th>txBytes</th><td>${f.txBytes ? `${(f.txBytes.length - 2) / 2} bytes — see raw proof bytes below` : '—'}</td></tr>`;
  $('pd-txbytes').textContent = f.txBytes ?? '—';
  $('pd-artifacts').textContent = art
    ? JSON.stringify({ merkleRoot: art.merkleRoot, merkleSiblings: art.merkleSiblings, continuity: art.continuity }, null, 2)
    : '—';

  renderDocket();
}

/* ---------- docket ---------- */
function pushDocket(label, data) {
  const no = docket.length + 1;
  docket.push({ no, label, data });
  return no;
}

function renderDocket() {
  const body = $('docket-body');
  if (!docket.length) {
    body.innerHTML = '<tr class="emptyrow"><td colspan="7">the docket is empty</td></tr>';
    return;
  }
  body.innerHTML = [...docket].reverse().map((e) => {
    const c = e.data.trace.certificate;
    const cur = e.no === currentNo;
    return `
      <tr data-no="${e.no}"${cur ? ' aria-current="true"' : ''} title="open this proceeding in the Chamber">
        <td class="num">QP-${String(e.no).padStart(3, '0')}</td>
        <td class="cause">${esc(e.label)}</td>
        <td>${esc(short(e.data.trace.fact.txHash, 10))}</td>
        <td>${c.quorum.approvals}/${c.quorum.fleetSize} (≥${c.quorum.required})</td>
        <td class="decision ${esc(c.decision)}">${esc(c.decision)}</td>
        <td>${esc(short(c.certHash, 8))}</td>
        <td>${esc(c.createdAt)}</td>
      </tr>`;
  }).join('');
  body.querySelectorAll('tr[data-no]').forEach((tr) =>
    tr.addEventListener('click', () => openDocketEntry(Number(tr.dataset.no))));
}

function openDocketEntry(no) {
  const entry = docket.find((e) => e.no === no);
  if (!entry) return;
  currentNo = no;
  renderChamber(entry);
  $('chamber').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- assess flow ---------- */
async function assess(txHash, label, btn) {
  label = label || scenarioNames.get(txHash) || 'in re unnamed source transaction';
  $('error').classList.add('hidden');
  if (btn) btn.classList.add('running');
  const go = $('assessBtn');
  go.disabled = true;
  go.textContent = 'Convening…';
  try {
    const r = await fetch('/api/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'assessment failed');
    currentNo = pushDocket(label, data);
    renderChamber(docket[docket.length - 1]);
  } catch (e) {
    const el = $('error');
    el.textContent = `PROCEEDING FAILED — ${esc(e.message)}`;
    el.classList.remove('hidden');
  } finally {
    if (btn) btn.classList.remove('running');
    go.disabled = false;
    go.textContent = 'Convene';
  }
}

$('clerk').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const v = $('txinput').value.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(v)) assess(v);
  else {
    const el = $('error');
    el.textContent = 'PROCEEDING REFUSED — enter a 32-byte transaction hash (0x + 64 hex characters)';
    el.classList.remove('hidden');
  }
});

/* ---------- boot: seed the Chamber with the recorded proceedings ---------- */
(async function boot() {
  try {
    const r = await fetch('/seed-trace.json');
    if (r.ok) {
      const seeds = await r.json();
      for (const s of seeds) pushDocket(s.label, s.data);
      if (docket.length) {
        currentNo = docket[docket.length - 1].no;
        renderChamber(docket[docket.length - 1]);
      }
    }
  } catch { /* no seed — Chamber stays awaiting */ }
  loadHealth();
})();
