/**
 * Pipeline facade: one call = verify fact -> fleet deliberation -> quorum gate
 * -> signed certificate -> enforcement. This is the unit the dashboard drives.
 */
import { attestTx, computePolicyId } from './attest/gateway.js';
import { Fleet } from './agents/fleet.js';
import { enforce, type SubmissionResult } from './chain/registry.js';
import type { CreditPolicy, DeliberationTrace } from './agents/types.js';
import {
  DEMO_TX_APPROVE,
  DEMO_TX_REJECT,
  ETHEREUM_MAINNET_CHAINKEY,
  LLM_API_KEY,
  LLM_MODEL,
  LLM_URL,
} from './config.js';
import { defaultFleet } from './agents/fleet.js';
import { keccak256 } from 'ethers';

/** The demo lending policy: a 3.6 ETH cross-chain repayment obligation. */
export function demoPolicy(): CreditPolicy {
  return {
    lender: '0x172AC97E50915292F2B3E8B56f6b4DDf80aC0489',
    expectedAmountWei: 3600000000000000000n, // 3.6 ETH
    shortfallToleranceBps: 10, // 0.1%
    overpayToleranceBps: 500, // 5%
    minAmountWei: 50000000000000000n, // 0.05 ETH dust floor
  };
}

export interface AssessOptions {
  txHash: string;
  chainKey?: number;
  policy?: CreditPolicy;
  quorumRequiredApprovals?: number;
}

export interface AssessResult {
  trace: DeliberationTrace;
  submission: SubmissionResult;
  fleetRoster: ReturnType<Fleet['roster']>;
  llmEnabled: boolean;
}

export async function assessTx(opts: AssessOptions): Promise<AssessResult> {
  const chainKey = opts.chainKey ?? ETHEREUM_MAINNET_CHAINKEY;
  const policy = opts.policy ?? demoPolicy();
  const fleet = new Fleet(defaultFleet(), {
    requiredApprovals: opts.quorumRequiredApprovals ?? 2,
    minMeanConfidence: 0.5,
  });

  const { fact, proofMs, verifyMs, decodeMs } = await attestTx(opts.txHash, chainKey);
  const trace = await fleet.deliberate(fact, policy);
  trace.timings.proofMs = proofMs;
  trace.timings.verifyMs = verifyMs;
  trace.timings.decodeMs = decodeMs;

  const submission = await enforce(trace);
  return {
    trace,
    submission,
    fleetRoster: fleet.roster,
    llmEnabled: Boolean(LLM_URL && LLM_MODEL && LLM_API_KEY),
  };
}

/** The two demo scenarios wired to real Ethereum mainnet txs. */
export function demoScenarios(): { name: string; txHash: string; note: string }[] {
  const p = demoPolicy();
  return [
    {
      name: 'repayment-received',
      txHash: DEMO_TX_APPROVE,
      note: `3.5999664 ETH to policy lender ${p.lender} (within 0.1% of the 3.6 ETH obligation) — expect EXECUTE`,
    },
    {
      name: 'unrelated-inflow',
      txHash: DEMO_TX_REJECT,
      note: `0.0568 ETH to a third party — legitimate transfer, but not the policy repayment — expect REJECT`,
    },
  ];
}

/** policyId is derived, keep it consistent for UI grouping */
export { computePolicyId, keccak256 };
