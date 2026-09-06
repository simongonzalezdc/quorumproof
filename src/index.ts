/**
 * QuorumProof CLI demo.
 *
 *   npm run demo                — runs both demo scenarios (EXECUTE + REJECT paths)
 *   npm run demo -- 0xTXX...    — assesses any Ethereum mainnet tx against the demo policy
 *
 * Every scenario runs the REAL pipeline: Attestcoin proof build (hosted proof
 * service) -> BlockProver precompile verification on CC3 testnet (eth_call)
 * -> on-chain decoder (eth_call) -> fleet deliberation -> signed quorum
 * certificate -> local enforcement (on-chain if a registry is configured).
 */
import { assessTx, demoScenarios, demoPolicy } from './pipeline.js';
import { renderCertificate } from './chain/registry.js';
import { computePolicyId } from './attest/gateway.js';

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function header(title: string): void {
  console.log(`\n${BOLD}${CYAN}═══ ${title} ═══${RESET}`);
}

async function run(txHash: string): Promise<boolean> {
  const started = Date.now();
  const { trace, submission, fleetRoster, llmEnabled } = await assessTx({ txHash });
  const f = trace.fact;

  header('1 · ATTESTCOIN FACT (verified on Creditcoin CC3 testnet)');
  console.log(
    [
      `  source tx     : ${f.txHash}`,
      `  source chain  : chainKey ${f.chainKey} (Ethereum) block ${f.headerNumber}#${f.txIndex}`,
      `  verification  : ${GREEN}${f.verifiedVia}${RESET}`,
      `  transfer      : ${f.from}`,
      `           ->   : ${f.to}`,
      `  amount        : ${Number(f.valueWei) / 1e18} ETH  (receipt status ${f.receiptStatus})`,
      `  factHash      : ${f.factHash}`,
      `  timings       : proof ${trace.timings.proofMs}ms · verify ${trace.timings.verifyMs}ms · decode ${trace.timings.decodeMs}ms`,
    ].join('\n'),
  );

  header('2 · FLEET DELIBERATION (2 rounds, secret ballot then debate)');
  console.log(`  policy        : ${demoPolicy().lender} expects ${Number(demoPolicy().expectedAmountWei) / 1e18} ETH  (policyId ${computePolicyId(demoPolicy()).slice(0, 18)}…)`);
  console.log(`  roster        : ${fleetRoster.map((r) => `${r.agentId}${llmEnabled && r.kind === 'llm' ? ' [LLM]' : ''}`).join(', ')}`);
  for (const round of trace.rounds) {
    console.log(`  ${DIM}— round ${round.round} —${RESET}`);
    for (const v of round.votes) {
      const color = v.vote === 'APPROVE' ? GREEN : v.vote === 'DENY' ? RED : DIM;
      console.log(`    ${v.agentId.padEnd(13)} ${color}${v.vote}${RESET}  conf=${v.confidence.toFixed(2)}  ${v.reasons[0] ?? ''}`);
    }
  }

  header('3 · QUORUM CERTIFICATE');
  console.log(renderCertificate(trace.certificate));
  const gate = trace.certificate.decision === 'EXECUTE' ? `${GREEN}EXECUTE${RESET}` : `${RED}REJECT${RESET}`;
  console.log(`  quorum gate   : ${gate}`);
  console.log(`  enforcement   : ${submission.mode} — ${submission.note}`);
  if (submission.txHash) console.log(`  registry tx   : ${submission.txHash}`);
  console.log(`  wall clock    : ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  ballot audit  : ${submission.failures.length === 0 ? `${GREEN}all signatures valid${RESET}` : `${RED}${submission.failures.join('; ')}${RESET}`}`);
  return trace.certificate.decision === 'EXECUTE';
}

const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('demo');
const arg = process.argv[2];

if (isMain) {
  (async () => {
    if (arg) {
      const ok = await run(arg);
      process.exit(ok ? 0 : 1);
    }
    let approves = 0;
    for (const s of demoScenarios()) {
      header(`SCENARIO: ${s.name} — ${s.txHash}`);
      console.log(`  ${DIM}${s.note}${RESET}`);
      const ok = await run(s.txHash);
      if (ok) approves++;
    }
    console.log(`\n${BOLD}RESULT: ${approves}/${demoScenarios().length} scenarios quorum-approved (expected: 1/1 approve path, reject path gated)${RESET}`);
    process.exit(0);
  })().catch((e) => {
    console.error('DEMO FAILED:', e);
    process.exit(2);
  });
}
