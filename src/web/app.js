/* QuorumProof dashboard — dependency-free. */
const $ = (id) => document.getElementById(id);
let scenarios = [];

function stageEl(n) { return $('stage-' + n); }
function setStage(n, state, html) {
  const el = stageEl(n);
  el.classList.remove('active', 'done');
  if (state) el.classList.add(state);
  if (html !== undefined) el.querySelector('.body').innerHTML = html;
}
function resetStages() {
  [1, 2, 3, 4].forEach((n) => setStage(n, null, 'waiting…'));
  $('cert').classList.add('hidden');
  $('cert-empty').classList.remove('hidden');
  $('error').classList.add('hidden');
}
function fail(msg) {
  const e = $('error');
  e.textContent = msg;
  e.classList.remove('hidden');
  [1, 2, 3, 4].forEach((n, i) => { if (!stageEl(n).classList.contains('done')) setStage(n, null, '—'); });
}

const weiToEth = (hexwei) => (Number(BigInt(hexwei)) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 8 });
const short = (s, n = 10) => s ? s.slice(0, n + 2) + '…' + (s.length > n + 4 ? s.slice(-4) : '') : '';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function loadHealth() {
  try {
    const r = await fetch('/api/health');
    const h = await r.json();
    $('netdot').classList.add('live');
    $('nettext').textContent = `CC3 testnet · block ${h.cc3Block.toLocaleString()} · mainnet attested to ${Number(h.attestedHeights.ethereumMainnet).toLocaleString()}`;
    const p = h.policy;
    $('policydl').innerHTML = `
      <dt>lender</dt><dd>${esc(short(p.lender, 16))}</dd>
      <dt>obligation</dt><dd>${weiToEth(p.expectedAmountWei)} ETH</dd>
      <dt>tolerances</dt><dd>shortfall ${p.shortfallToleranceBps / 100}% · overpay ${p.overpayToleranceBps / 100}%</dd>
      <dt>dust floor</dt><dd>${weiToEth(p.minAmountWei)} ETH</dd>`;
    scenarios = h.scenarios;
    $('scenarios').innerHTML = h.scenarios.map((s, i) => `
      <button class="scenario" data-i="${i}">
        <div class="name">▶ ${esc(s.name)} <span style="color:var(--dim)">${esc(short(s.txHash, 6))}</span></div>
        <div class="note">${esc(s.note)}</div>
      </button>`).join('');
    document.querySelectorAll('.scenario').forEach((b) =>
      b.addEventListener('click', () => assess(scenarios[Number(b.dataset.i)].txHash, b)));
  } catch {
    $('netdot').classList.add('dead');
    $('nettext').textContent = 'CC3 testnet unreachable';
  }
}

function ballotRow(v, prev) {
  const changed = prev && (prev.vote !== v.vote || Math.abs(prev.confidence - v.confidence) > 1e-9);
  return `<div class="ballot">
    <span class="who">${esc(v.agentId)}</span>
    <span class="what ${v.vote}">${v.vote} ${v.confidence.toFixed(2)}</span>
    ${changed ? '<span class="flip">revised</span>' : ''}
    <span class="why">${esc(v.reasons.join(' · '))}</span>
  </div>`;
}

async function assess(txHash, btn) {
  resetStages();
  if (btn) btn.classList.add('running');
  $('assessBtn').disabled = true;
  stageEl(1).classList.add('active');
  try {
    const t0 = performance.now();
    const r = await fetch('/api/assess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'assessment failed');
    const ms = Math.round(performance.now() - t0);

    const f = data.trace.fact;
    setStage(1, 'done', `<span class="ok">✓ verified by ${esc(f.verifiedVia)}</span>
source chainKey ${f.chainKey} · block ${f.headerNumber.toLocaleString()} #${f.txIndex}
${esc(f.from)} → ${esc(f.to)}
${weiToEth(f.valueWei)} ETH · receipt status ${f.receiptStatus ?? '?'}
factHash ${esc(short(f.factHash, 18))}
proof ${data.trace.timings.proofMs}ms · verify ${data.trace.timings.verifyMs}ms · decode ${data.trace.timings.decodeMs}ms · total ${ms}ms`);

    const r1 = data.trace.rounds[0].votes;
    setStage(2, 'done', r1.map((v) => ballotRow(v, null)).join(''));
    const r2 = data.trace.rounds[1].votes;
    setStage(3, 'done', r2.map((v, i) => ballotRow(v, r1[i])).join(''));

    const q = data.trace.certificate.quorum;
    const met = data.trace.certificate.decision === 'EXECUTE';
    setStage(4, 'done', met
      ? `<span class="ok">✓ QUORUM MET</span> — ${q.approvals}/${q.fleetSize} approvals (≥${q.required} required) → autonomous execution authorized`
      : `<span class="bad">✗ QUORUM NOT MET</span> — ${q.approvals}/${q.fleetSize} approvals (<${q.required} required) → action blocked, certificate still recorded`);

    $('roster').innerHTML = data.fleetRoster.map((a) => `
      <li>${esc(a.agentId)} <span class="hint">(${esc(a.kind)})</span><br/><span class="addr">${esc(a.agentAddress)}</span><br/><span class="hint">${esc(a.charter)}</span></li>`).join('');

    const c = data.trace.certificate;
    $('cert-empty').classList.add('hidden');
    $('cert').classList.remove('hidden');
    $('verdict').textContent = c.decision;
    $('verdict').className = 'verdict ' + c.decision;
    $('certdl').innerHTML = `
      <dt>factHash</dt><dd>${esc(short(c.factHash, 16))}</dd>
      <dt>policyId</dt><dd>${esc(short(c.policyId, 16))}</dd>
      <dt>certHash</dt><dd>${esc(short(c.certHash, 16))}</dd>
      <dt>ballots</dt><dd>${c.votes.length} signed · audit ${data.submission.failures.length === 0 ? '<span class="ok">clean</span>' : '<span class="bad">FAILED</span>'}</dd>
      <dt>issued</dt><dd>${esc(c.createdAt)}</dd>`;
    $('votes').innerHTML = c.votes.filter((v) => v.round === 2).map((v) => `
      <li><span class="what ${v.vote}">${esc(v.agentId)}: ${v.vote}</span> conf ${v.confidence.toFixed(2)}<br/>
      ${esc(v.agentAddress)} · sig ${esc(short(v.signature, 8))}</li>`).join('');
    $('enforcement').textContent = `${data.submission.mode} enforcement — ${data.submission.note}` + (data.llmEnabled ? ' · LLM analyst enabled' : ' · deterministic fleet');
  } catch (e) {
    fail(e.message);
  } finally {
    if (btn) btn.classList.remove('running');
    $('assessBtn').disabled = false;
  }
}

$('assessBtn').addEventListener('click', () => {
  const v = $('txinput').value.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(v)) assess(v);
  else fail('enter a 32-byte transaction hash (0x + 64 hex chars)');
});
loadHealth();
