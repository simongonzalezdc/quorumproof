/**
 * On-chain enforcement suite (t_6e9c6da1 / AC1–AC5).
 *
 * QuorumRegistry must enforce — from committed on-chain state, never from
 * caller arguments — WHO may ballot (roster membership via agentControl),
 * HOW MANY approvals execute (owner-committed policyQuorum), and WHAT gets
 * recorded (decision derived as approvals >= threshold).
 *
 * Like test/parity.test.ts this is NOT a TS-with-TS test: it compiles the
 * actual contracts/QuorumRegistry.sol with solc and executes its bytecode in
 * a local ethereumjs-VM. No network, no funded keys, no CC3 deployment.
 *
 * Red/green: the equivalent exploit calls against the PRE-FIX contract are
 * demonstrated in the card evidence (red-enforcement log): a submitter could
 * pass signers[] self-asserted (or all-zero = "any address"), decision=1 and
 * requiredApprovals=0 and record EXECUTE with zero approvals. Here, those
 * parameters no longer exist in the ABI and the behaviors below are asserted
 * as reverts / derived outcomes.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAddressFromString, type Address } from '@ethereumjs/util';
import { createVM, type VM } from '@ethereumjs/vm';
import { getBytes, Interface, keccak256, toUtf8Bytes, Wallet } from 'ethers';
import { agentIdHash, splitSignature, voteDigest, VOTE_BYTE } from '../src/agents/certificate.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOL_PATH = join(here, '..', 'contracts', 'QuorumRegistry.sol');

const POLICY_ID = keccak256(toUtf8Bytes('enforcement.policy'));
const AGENT_IDS = ['ledger-01', 'sentinel-02', 'meridian-03'] as const;
const REQUIRED_APPROVALS = 2;

/** Deterministic throwaway wallets (documented test keys, no value anywhere). */
function agentWallet(id: string): Wallet {
  return new Wallet(keccak256(toUtf8Bytes(`enforcement-test-key:${id}`)));
}

/** A wallet that was NEVER registered in any roster. */
const strangerWallet = new Wallet(keccak256(toUtf8Bytes('enforcement-test-key:stranger')));

function factOf(tag: string): string {
  return keccak256(toUtf8Bytes(`enforcement.fact.${tag}`));
}

/** Genuine EIP-191 signatures over the canonical round-2 digests. */
async function ballotsFor(
  factHash: string,
  votes: ('ABSTAIN' | 'APPROVE' | 'DENY')[],
  signerFor?: (i: number) => Wallet,
): Promise<{ agentIds: string[]; r: string[]; s: string[]; v: number[]; votes: number[] }> {
  const walletAt = (i: number) => (signerFor ? signerFor(i) : agentWallet(AGENT_IDS[i]!));
  const sigs = await Promise.all(
    votes.map((vote, i) => {
      const digest = voteDigest({ factHash, policyId: POLICY_ID, round: 2, agentId: AGENT_IDS[i]!, vote });
      return walletAt(i).signMessage(getBytes(digest));
    }),
  );
  const parts = sigs.map((sig) => splitSignature(sig));
  return {
    agentIds: votes.map((_, i) => agentIdHash(AGENT_IDS[i]!)),
    r: parts.map((p) => p.r),
    s: parts.map((p) => p.s),
    v: parts.map((p) => p.v),
    votes: votes.map((vote) => VOTE_BYTE[vote]),
  };
}

interface CallResult {
  ok: boolean;
  data: string;
}

describe('QuorumRegistry on-chain enforcement (membership, threshold, derived decision)', () => {
  let vm: VM;
  let iface: Interface;
  let registry: Address;
  const owner = createAddressFromString('0x9999999999999999999999999999999999999999');
  const ATTACKER_ADDR = '0x8888888888888888888888888888888888888888';
  const attacker = createAddressFromString(ATTACKER_ADDR);

  beforeAll(async () => {
    const require = createRequire(import.meta.url);
    const solc = require('solc') as { compile(stdInput: string): string };
    const input = {
      language: 'Solidity' as const,
      sources: { 'QuorumRegistry.sol': { content: readFileSync(SOL_PATH, 'utf8') } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        viaIR: true,
        evmVersion: 'shanghai',
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
      },
    };
    const compiled = JSON.parse(solc.compile(JSON.stringify(input))) as {
      errors?: { severity: string; formattedMessage: string }[];
      contracts: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
    };
    const fatal = (compiled.errors ?? []).filter((e) => e.severity === 'error');
    expect(fatal, fatal.map((e) => e.formattedMessage).join('\n')).toEqual([]);
    const artifact = compiled.contracts['QuorumRegistry.sol']!['QuorumRegistry']!;
    expect(artifact.evm.bytecode.object.length).toBeGreaterThan(0);

    iface = new Interface(artifact.abi as never);
    vm = await createVM();
    const deploy = await vm.evm.runCall({
      caller: owner,
      data: Buffer.from(artifact.evm.bytecode.object, 'hex'),
      gasLimit: 60_000_000n,
      value: 0n,
    });
    expect(deploy.execResult.exceptionError?.error).toBeUndefined();
    registry = deploy.createdAddress!;

    // Roster: all three agents registered by the owner; threshold committed.
    for (const agentId of AGENT_IDS) {
      const reg = await call('registerAgent', [agentIdHash(agentId), agentWallet(agentId).address]);
      expect(reg.ok, `registerAgent(${agentId}) reverted: ${reg.data}`).toBe(true);
    }
    const pol = await call('registerPolicy', [POLICY_ID, REQUIRED_APPROVALS]);
    expect(pol.ok, `registerPolicy reverted: ${pol.data}`).toBe(true);
  }, 180_000);

  async function callFrom(caller: Address, fn: string, args: unknown[]): Promise<CallResult> {
    const data = Buffer.from(getBytes(iface.encodeFunctionData(fn, args)));
    const res = await vm.evm.runCall({ caller, to: registry, data, gasLimit: 10_000_000n, value: 0n });
    return { ok: !res.execResult.exceptionError, data: '0x' + Buffer.from(res.execResult.returnValue).toString('hex') };
  }

  async function call(fn: string, args: unknown[]): Promise<CallResult> {
    return callFrom(owner, fn, args);
  }

  function selectorOf(errorName: string): string {
    return iface.getError(errorName)!.selector;
  }

  async function submit(factHash: string, ballots: Awaited<ReturnType<typeof ballotsFor>>): Promise<CallResult> {
    return call('submitDecision', [factHash, POLICY_ID, ballots.agentIds, ballots.r, ballots.s, ballots.v, ballots.votes]);
  }

  async function recordedDecision(factHash: string): Promise<{ decision: bigint; approvals: bigint; fleetSize: bigint }> {
    const res = await call('decisions', [factHash]);
    const [, decision, approvals, fleetSize] = iface
      .decodeFunctionResult('decisions', res.data)
      .toArray() as [string, bigint, bigint, bigint, bigint];
    return { decision, approvals, fleetSize };
  }

  // ---------------------------------------------------------------- AC1 ----

  it('AC1: a ballot from an UNREGISTERED agent reverts NotRegistered (roster is on-chain state, not calldata)', async () => {
    // Agent "rogue-04" signs its own genuine ballot but was never registered.
    const rogueId = 'rogue-04';
    const fact = factOf('unregistered');
    const good = await ballotsFor(fact, ['APPROVE', 'APPROVE', 'DENY']);
    const rogueDigest = voteDigest({ factHash: fact, policyId: POLICY_ID, round: 2, agentId: rogueId, vote: 'APPROVE' });
    const rogue = splitSignature(await agentWallet(rogueId).signMessage(getBytes(rogueDigest)));
    const res = await call('submitDecision', [
      fact,
      POLICY_ID,
      [...good.agentIds, agentIdHash(rogueId)],
      [...good.r, rogue.r],
      [...good.s, rogue.s],
      [...good.v, rogue.v],
      [...good.votes, VOTE_BYTE.APPROVE],
    ]);
    expect(res.ok).toBe(false);
    expect(res.data.startsWith(selectorOf('NotRegistered'))).toBe(true);
    // the revert names the offending agentId
    const [named] = iface.decodeErrorResult('NotRegistered', res.data).toArray() as string[];
    expect(named).toBe(agentIdHash(rogueId));
    // and nothing was recorded (timestamp still unset)
    const rec = await call('decisions', [fact]);
    expect(iface.decodeFunctionResult('decisions', rec.data).toArray()[4]).toBe(0n);
  });

  it('AC1: a genuine ballot signed by the WRONG key reverts BadSigner (expected signer resolved from agentControl)', async () => {
    const fact = factOf('wrong-signer');
    // ledger-01's agentId, but the digest is signed by an unregistered stranger.
    const ballots = await ballotsFor(fact, ['APPROVE', 'APPROVE', 'DENY'], (i) =>
      i === 0 ? strangerWallet : agentWallet(AGENT_IDS[i]!),
    );
    const res = await submit(fact, ballots);
    expect(res.ok).toBe(false);
    expect(res.data.startsWith(selectorOf('BadSigner'))).toBe(true);
  });

  // ---------------------------------------------------------------- AC2 ----

  it('AC2: a zero threshold is unrepresentable — registerPolicy(…, 0) reverts BadThreshold', async () => {
    const res = await call('registerPolicy', [keccak256(toUtf8Bytes('enforcement.zero-policy')), 0]);
    expect(res.ok).toBe(false);
    expect(res.data.startsWith(selectorOf('BadThreshold'))).toBe(true);
  });

  it('AC2: an unregistered policy blocks submission — PolicyNotRegistered (threshold cannot be supplied in the call)', async () => {
    const fact = factOf('no-policy');
    const ballots = await ballotsFor(fact, ['APPROVE', 'APPROVE', 'APPROVE']);
    const unknownPolicy = keccak256(toUtf8Bytes('enforcement.never-registered'));
    const res = await call('submitDecision', [fact, unknownPolicy, ballots.agentIds, ballots.r, ballots.s, ballots.v, ballots.votes]);
    expect(res.ok).toBe(false);
    expect(res.data.startsWith(selectorOf('PolicyNotRegistered'))).toBe(true);
  });

  it('AC2: a non-owner cannot register or lower a threshold — NotOwner (owner-committed state only)', async () => {
    // attacker tries to lower the committed threshold 2 -> 1
    const lower = await callFrom(attacker, 'registerPolicy', [POLICY_ID, 1]);
    expect(lower.ok).toBe(false);
    expect(lower.data.startsWith(selectorOf('NotOwner'))).toBe(true);
    // attacker also cannot inject a roster member
    const inject = await callFrom(attacker, 'registerAgent', [agentIdHash('attacker-99'), ATTACKER_ADDR]);
    expect(inject.ok).toBe(false);
    expect(inject.data.startsWith(selectorOf('NotOwner'))).toBe(true);
    // committed threshold is unchanged
    const committed = await call('policyQuorum', [POLICY_ID]);
    expect(committed.data).toBe('0x' + BigInt(REQUIRED_APPROVALS).toString(16).padStart(64, '0'));
  });

  // ---------------------------------------------------------------- AC3 ----

  it('AC3: decision is DERIVED — 1 approval vs committed threshold 2 records REJECT even though the fleet claimed EXECUTE', async () => {
    const fact = factOf('under-threshold');
    const ballots = await ballotsFor(fact, ['APPROVE', 'DENY', 'ABSTAIN']); // approvals = 1 < 2
    const res = await submit(fact, ballots);
    expect(res.ok, `submitDecision reverted: ${res.data}`).toBe(true);
    const rec = await recordedDecision(fact);
    expect(rec.decision).toBe(0n); // REJECT — there is no decision argument to claim EXECUTE with
    expect(rec.approvals).toBe(1n);
    expect(rec.fleetSize).toBe(3n);
  });

  it('AC3 anchor: zero approvals (all ABSTAIN) records REJECT — the old requiredApprovals=0 EXECUTE exploit is gone', async () => {
    const fact = factOf('zero-approvals');
    const ballots = await ballotsFor(fact, ['ABSTAIN', 'ABSTAIN', 'ABSTAIN']); // approvals = 0
    const res = await submit(fact, ballots);
    expect(res.ok, `submitDecision reverted: ${res.data}`).toBe(true);
    const rec = await recordedDecision(fact);
    expect(rec.decision).toBe(0n); // REJECT with zero approvals — NOT EXECUTE
    expect(rec.approvals).toBe(0n);
  });

  it('AC3: approvals exactly meeting the committed threshold records EXECUTE', async () => {
    const fact = factOf('at-threshold');
    const ballots = await ballotsFor(fact, ['APPROVE', 'APPROVE', 'DENY']); // approvals = 2 >= 2
    const res = await submit(fact, ballots);
    expect(res.ok, `submitDecision reverted: ${res.data}`).toBe(true);
    const rec = await recordedDecision(fact);
    expect(rec.decision).toBe(1n);
    expect(rec.approvals).toBe(2n);
  });

  // ------------------------------------------------------- ABI structure ----

  it('ABI: submitDecision accepts ONLY the ballots — no decision, signers[] or requiredApprovals parameter exists', () => {
    const inputs = iface.getFunction('submitDecision')!.inputs;
    expect(inputs.map((i) => i.type)).toEqual(['bytes32', 'bytes32', 'bytes32[]', 'bytes32[]', 'bytes32[]', 'uint8[]', 'uint8[]']);
    // no free-standing scalar uint8 (the old `decision` / `requiredApprovals`)
    expect(inputs.some((i) => i.type === 'uint8')).toBe(false);
    // no address array (the old self-asserted `signers[]`)
    expect(inputs.some((i) => i.type === 'address[]')).toBe(false);
  });

  it('registerAgent rejects a zero control address — ZeroControl (roster entries are meaningful)', async () => {
    const res = await call('registerAgent', [agentIdHash('ghost-00'), '0x0000000000000000000000000000000000000000']);
    expect(res.ok).toBe(false);
    expect(res.data.startsWith(selectorOf('ZeroControl'))).toBe(true);
  });
});
