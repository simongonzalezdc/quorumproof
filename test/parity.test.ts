/**
 * Cross-language parity suite (AC2/AC3 of the digest-parity fix).
 *
 * The TypeScript signer (src/agents/certificate.ts) and the Solidity registry
 * (contracts/QuorumRegistry.sol) MUST compute byte-identical ballot digests and
 * certificate hashes, and QuorumRegistry.submitDecision MUST recover the roster
 * signer from real, TS-produced signatures.
 *
 * This is NOT a TS-with-TS test: it compiles the actual .sol file with solc and
 * executes its bytecode in a local ethereumjs-VM — no network, no keys with
 * value, no deployment to CC3. If either side drifts, byte equality fails here
 * even though every TS-only test stays green.
 *
 * Canonical layout (must match certificate.ts and QuorumRegistry.sol):
 *   ballot digest  = keccak256(abi.encode(factHash, policyId, round, agentId, vote))
 *                    — padded (non-packed) encoding, 160-byte preimage,
 *                      on-chain submissions bind round = 2 (final ballots).
 *   certificate    = keccak256(abi.encode("QUORUMPROOF_V1", factHash, policyId,
 *                                          decision, approvals, fleetSize))
 *                    — 256-byte preimage, approvals ARE bound.
 *   EIP-191 frame  = keccak256("\x19Ethereum Signed Message:\n32" ++ digest);
 *                    the fleet signs with wallet.signMessage(getBytes(digest)).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAddressFromString, type Address } from '@ethereumjs/util';
import { createVM, type VM } from '@ethereumjs/vm';
import { getBytes, hashMessage, Interface, keccak256, toUtf8Bytes, verifyMessage, Wallet } from 'ethers';
import {
  agentIdHash,
  certificateHash,
  eip191Digest,
  splitSignature,
  voteDigest,
  VOTE_BYTE,
} from '../src/agents/certificate.js';

const here = dirname(fileURLToPath(import.meta.url));
const SOL_PATH = join(here, '..', 'contracts', 'QuorumRegistry.sol');

/** Deterministic test vector — same inputs go to BOTH sides. */
const FACT_HASH = keccak256(toUtf8Bytes('parity.fact')); // 0x…
const POLICY_ID = keccak256(toUtf8Bytes('parity.policy'));
const AGENT_IDS = ['ledger-01', 'sentinel-02', 'meridian-03'] as const;
const AGENT_VOTES = ['APPROVE', 'APPROVE', 'DENY'] as const; // approvals = 2 of 3
const REQUIRED_APPROVALS = 2;

/** Deterministic throwaway wallets (documented test keys, no value anywhere). */
function agentWallet(id: string): Wallet {
  return new Wallet(keccak256(toUtf8Bytes(`parity-test-key:${id}`)));
}

interface CallResult {
  ok: boolean;
  data: string; // hex of return/revert payload
}

describe('QuorumRegistry ⇄ certificate.ts cross-language parity', () => {
  let vm: VM;
  let iface: Interface;
  let registry: Address;
  const caller = createAddressFromString('0x9999999999999999999999999999999999999999');

  /** Compile the real contract and deploy it to a fresh local VM. */
  beforeAll(async () => {
    const require = createRequire(import.meta.url);
    const solc = require('solc') as { compile(stdInput: string): string };
    const input = {
      language: 'Solidity' as const,
      sources: { 'QuorumRegistry.sol': { content: readFileSync(SOL_PATH, 'utf8') } },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        viaIR: true, // pristine submitDecision hits "Stack too deep" under legacy codegen
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
      caller,
      data: Buffer.from(artifact.evm.bytecode.object, 'hex'),
      gasLimit: 60_000_000n,
      value: 0n,
    });
    expect(deploy.execResult.exceptionError?.error).toBeUndefined();
    registry = deploy.createdAddress!;
  }, 180_000);

  /** eth_call-style invocation against the deployed bytecode. */
  async function call(fn: string, args: unknown[]): Promise<CallResult> {
    const data = Buffer.from(getBytes(iface.encodeFunctionData(fn, args)));
    const res = await vm.evm.runCall({ caller, to: registry, data, gasLimit: 10_000_000n, value: 0n });
    const out = '0x' + Buffer.from(res.execResult.returnValue).toString('hex');
    return { ok: !res.execResult.exceptionError, data: out };
  }

  function selectorOf(errorName: string): string {
    return iface.getError(errorName)!.selector;
  }

  it('contract exposes the canonical digest helpers (ballotDigestOf, certificateHashOf)', () => {
    expect(iface.hasFunction('ballotDigestOf')).toBe(true);
    expect(iface.hasFunction('certificateHashOf')).toBe(true);
  });

  it('ballot digest: Solidity keccak(abi.encode(...)) === TS voteDigest(round 2), all agents × all vote bytes', async () => {
    for (const agentId of AGENT_IDS) {
      for (const vote of ['ABSTAIN', 'APPROVE', 'DENY'] as const) {
        const ts = voteDigest({ factHash: FACT_HASH, policyId: POLICY_ID, round: 2, agentId, vote });
        const chain = await call('ballotDigestOf', [FACT_HASH, POLICY_ID, 2, agentIdHash(agentId), VOTE_BYTE[vote]]);
        expect(chain.ok, `ballotDigestOf reverted: ${chain.data}`).toBe(true);
        expect(chain.data).toBe(ts); // byte equality — the one canonical layout
      }
    }
  });

  it('the round byte is genuinely bound: on-chain digest ≠ TS round-1 digest', async () => {
    const tsRound1 = voteDigest({ factHash: FACT_HASH, policyId: POLICY_ID, round: 1, agentId: AGENT_IDS[0]!, vote: 'APPROVE' });
    const chainRound2 = await call('ballotDigestOf', [FACT_HASH, POLICY_ID, 2, agentIdHash(AGENT_IDS[0]!), VOTE_BYTE.APPROVE]);
    expect(chainRound2.ok).toBe(true);
    expect(chainRound2.data).not.toBe(tsRound1);
  });

  it('certificate hash: Solidity === TS certificateHash, with approvals bound on both sides', async () => {
    const ts = certificateHash({ factHash: FACT_HASH, policyId: POLICY_ID, decision: 'EXECUTE', approvals: 2, fleetSize: 3 });
    const chain = await call('certificateHashOf', [FACT_HASH, POLICY_ID, 1, 2, 3]);
    expect(chain.ok, `certificateHashOf reverted: ${chain.data}`).toBe(true);
    expect(chain.data).toBe(ts);

    // approvals is a bound field on-chain too (the old contract dropped it)
    const a2 = await call('certificateHashOf', [FACT_HASH, POLICY_ID, 1, 2, 3]);
    const a3 = await call('certificateHashOf', [FACT_HASH, POLICY_ID, 1, 3, 3]);
    expect(a2.data).not.toBe(a3.data);
  });

  it('EIP-191 framing: signature over raw digest bytes (\\n32) recovers; hex-string framing (\\n66) does not', async () => {
    const w = agentWallet(AGENT_IDS[0]!);
    const digest = voteDigest({ factHash: FACT_HASH, policyId: POLICY_ID, round: 2, agentId: AGENT_IDS[0]!, vote: 'APPROVE' });
    // canonical: what QuorumRegistry hashes and what the fleet signs
    expect(eip191Digest(digest)).toBe(hashMessage(getBytes(digest)));
    const good = await w.signMessage(getBytes(digest));
    expect(verifyMessage(getBytes(digest), good).toLowerCase()).toBe(w.address.toLowerCase());
    // the old latent bug: signing the hex *string* UTF-8-encodes it — unrecoverable on-chain
    const bad = await w.signMessage(digest);
    expect(verifyMessage(getBytes(digest), bad).toLowerCase()).not.toBe(w.address.toLowerCase());
  });

  it('submitDecision accepts 3/3 genuine TS-signed ballots and records the TS certificate hash (AC3 round-trip)', async () => {
    const wallets = AGENT_IDS.map(agentWallet);
    const ballots = AGENT_IDS.map((agentId, i) => {
      const digest = voteDigest({ factHash: FACT_HASH, policyId: POLICY_ID, round: 2, agentId, vote: AGENT_VOTES[i]! });
      return { digest, wallet: wallets[i]!, vote: AGENT_VOTES[i]! };
    });
    const sigs = await Promise.all(ballots.map((b) => b.wallet.signMessage(getBytes(b.digest))));
    const parts = sigs.map(splitSignature);

    // local sanity: each signature recovers its own roster address under the canonical digest
    ballots.forEach((b, i) => {
      const recovered = verifyMessage(getBytes(b.digest), sigs[i]!);
      // eslint-disable-next-line no-console
      console.log(
        `  ${AGENT_IDS[i]}`.padEnd(16),
        `roster ${b.wallet.address} recovered ${recovered}`,
        recovered.toLowerCase() === b.wallet.address.toLowerCase() ? 'MATCH' : 'MISMATCH',
      );
    });

    const sub = await call('submitDecision', [
      FACT_HASH,
      POLICY_ID,
      1, // EXECUTE claim
      AGENT_IDS.map(agentIdHash),
      wallets.map((w) => w.address), // expected signers: any mismatch ⇒ BadSigner
      parts.map((p) => p.r),
      parts.map((p) => p.s),
      parts.map((p) => p.v),
      ballots.map((b) => VOTE_BYTE[b.vote]),
      REQUIRED_APPROVALS,
    ]);
    expect(sub.ok, `submitDecision reverted: ${sub.data}`).toBe(true); // no BadSigner()

    const expectedCert = certificateHash({
      factHash: FACT_HASH,
      policyId: POLICY_ID,
      decision: 'EXECUTE',
      approvals: 2,
      fleetSize: 3,
    });
    expect(sub.data).toBe(expectedCert); // on-chain cert hash === TS cert hash

    const [recCert, recDecision, recApprovals, recFleet] = iface
      .decodeFunctionResult('decisions', (await call('decisions', [FACT_HASH])).data)
      .toArray() as [string, bigint, bigint, bigint];
    expect(recCert).toBe(expectedCert);
    expect(recDecision).toBe(1n);
    expect(recApprovals).toBe(2n);
    expect(recFleet).toBe(3n);
  }, 30_000);

  it('tamper control: flipping one vote byte reverts BadSigner on-chain', async () => {
    // distinct factHash: the round-trip test already recorded a decision for FACT_HASH
    const tamperFact = keccak256(toUtf8Bytes('parity.fact.tamper'));
    const ballots = AGENT_IDS.map((agentId, i) => ({
      digest: voteDigest({ factHash: tamperFact, policyId: POLICY_ID, round: 2, agentId, vote: AGENT_VOTES[i]! }),
      vote: AGENT_VOTES[i]!,
    }));
    const wallets = AGENT_IDS.map(agentWallet);
    const sigs = await Promise.all(ballots.map((b, i) => wallets[i]!.signMessage(getBytes(b.digest))));
    const parts = sigs.map(splitSignature);
    const votes: number[] = ballots.map((b) => VOTE_BYTE[b.vote]);
    votes[2] = (votes[2]! + 1) % 3; // claim DENY→ABSTAIN without a matching signature

    const sub = await call('submitDecision', [
      tamperFact,
      POLICY_ID,
      1,
      AGENT_IDS.map(agentIdHash),
      wallets.map((w) => w.address),
      parts.map((p) => p.r),
      parts.map((p) => p.s),
      parts.map((p) => p.v),
      votes,
      REQUIRED_APPROVALS,
    ]);
    expect(sub.ok).toBe(false);
    expect(sub.data.startsWith(selectorOf('BadSigner'))).toBe(true);
  }, 30_000);

  it('duplicate-signer control: the same ballot twice reverts DuplicateSigner', async () => {
    const dupFact = keccak256(toUtf8Bytes('parity.fact.dup'));
    const dupAgentId = agentIdHash(AGENT_IDS[0]!);
    const digest = voteDigest({ factHash: dupFact, policyId: POLICY_ID, round: 2, agentId: AGENT_IDS[0]!, vote: 'APPROVE' });
    const w = agentWallet(AGENT_IDS[0]!);
    const { r, s, v } = splitSignature(await w.signMessage(getBytes(digest)));
    // same agentId + same signature twice: the digest is identical, so the same
    // address recovers twice and the seen[] check fires DuplicateSigner
    const sub = await call('submitDecision', [
      dupFact,
      POLICY_ID,
      1,
      [dupAgentId, dupAgentId],
      [w.address, w.address],
      [r, r],
      [s, s],
      [v, v],
      [VOTE_BYTE.APPROVE, VOTE_BYTE.APPROVE],
      REQUIRED_APPROVALS,
    ]);
    expect(sub.ok).toBe(false);
    expect(sub.data.startsWith(selectorOf('DuplicateSigner'))).toBe(true);
  }, 30_000);
});
