/**
 * Canonical ballot + certificate hashing shared by the fleet (signing),
 * the local auditor (recovery), and the Solidity registry (recovery).
 *
 * THE canonical byte layout (mirrored by QuorumRegistry.ballotDigestOf /
 * .certificateHashOf and enforced cross-language by test/parity.test.ts,
 * which compiles the contract and executes it in a local EVM):
 *
 *   ballot digest = keccak256(abi.encode(bytes32 factHash,
 *                                     bytes32 policyId,
 *                                     uint8   round,      // padded to 32
 *                                     bytes32 agentId,
 *                                     uint8   vote))      // padded to 32
 *                   → 160-byte preimage, PADDED abi.encode (never
 *                     abi.encodePacked — the contract side must not pack).
 *
 *   cert hash     = keccak256(abi.encode(string  "QUORUMPROOF_V1",
 *                                     bytes32 factHash,
 *                                     bytes32 policyId,
 *                                     uint8   decision,
 *                                     uint8   approvals,  // bound on-chain too
 *                                     uint8   fleetSize))
 *                   → 256-byte preimage.
 *
 * Signatures are EIP-191 personal_sign over the RAW 32-byte digest:
 *   keccak256("\x19Ethereum Signed Message:\n32" ++ digest)
 * i.e. the fleet signs with `wallet.signMessage(getBytes(digest))` — passing
 * the hex STRING would UTF-8-encode it ("\n66" framing) and the contract's
 * ecrecover would fail for every genuine ballot.
 */
import { AbiCoder, keccak256 } from 'ethers';

export const VOTE_BYTE = { ABSTAIN: 0, APPROVE: 1, DENY: 2 } as const;
export type VoteByte = (typeof VOTE_BYTE)[keyof typeof VOTE_BYTE];

const coder = AbiCoder.defaultAbiCoder();

/** agentId (utf8) -> bytes32 agent id used on-chain */
export function agentIdHash(agentId: string): string {
  return keccak256(Buffer.from(agentId, 'utf8'));
}

/**
 * Ballot digest — keccak256(abi.encode(factHash, policyId, round, agentId, voteByte)).
 * All fields are static 32-byte words, so abi.encode == concat(packed words).
 * The signer signs the EIP-191 personal message of this 32-byte digest, which
 * QuorumRegistry recovers with keccak("\x19Ethereum Signed Message:\n32" ++ digest).
 */
export function voteDigest(params: {
  factHash: string;
  policyId: string;
  round: number;
  agentId: string;
  vote: keyof typeof VOTE_BYTE;
}): string {
  return keccak256(
    coder.encode(
      ['bytes32', 'bytes32', 'uint8', 'bytes32', 'uint8'],
      [params.factHash, params.policyId, params.round, agentIdHash(params.agentId), VOTE_BYTE[params.vote]],
    ),
  );
}

/** EIP-191 personal_sign of the ballot digest (what ethers signMessage(digest) produces). */
export function eip191Digest(digest: string): string {
  return keccak256(
    Buffer.concat([Buffer.from('\x19Ethereum Signed Message:\n32', 'utf8'), Buffer.from(digest.slice(2), 'hex')]),
  );
}

/** Canonical certificate hash over the round-2 ballots. */
export function certificateHash(params: {
  factHash: string;
  policyId: string;
  decision: 'EXECUTE' | 'REJECT';
  approvals: number;
  fleetSize: number;
}): string {
  return keccak256(
    coder.encode(
      ['string', 'bytes32', 'bytes32', 'uint8', 'uint8', 'uint8'],
      [
        'QUORUMPROOF_V1',
        params.factHash,
        params.policyId,
        params.decision === 'EXECUTE' ? 1 : 0,
        params.approvals,
        params.fleetSize,
      ],
    ),
  );
}

/** Split a 65-byte ethers signature into r/s/v for the registry. */
export function splitSignature(sig: string): { r: string; s: string; v: number } {
  const raw = sig.replace(/^0x/, '');
  if (raw.length !== 130) throw new Error(`bad signature length ${raw.length}`);
  return {
    r: '0x' + raw.slice(0, 64),
    s: '0x' + raw.slice(64, 128),
    v: parseInt(raw.slice(128, 130), 16),
  };
}
