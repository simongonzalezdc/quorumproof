// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title QuorumRegistry
 * @notice On-chain record of AI-agent-fleet decisions over Attestcoin-verified
 *         cross-chain facts. Creditcoin (CC3) deployment.
 *
 * Trust model:
 *  - The FACT (cross-chain transaction) is already proven inside Creditcoin's
 *    trust domain by the Attestcoin BlockProver precompile (0x...FD2) — this
 *    contract deliberately does NOT re-verify it. Callers pass the factHash
 *    returned by the attestation pipeline (keccak(chainKey, headerNumber,
 *    txHash, verified)).
 *  - The DECISION is what this contract enforces: every ballot must carry a
 *    valid EIP-191 signature from the registered agent control address,
 *    ballots must bind the exact factHash/policyId/round, signers must be
 *    distinct, and approvals must meet the quorum threshold — otherwise the
 *    submission reverts.
 *  - The recorded decision becomes a Creditcoin state fact (mapping + event)
 *    any downstream protocol can consume: release collateral, mark repaid,
 *    gate credit lines, settle DePIN invoices, etc.
 *
 * Canonical hashing (MUST byte-match src/agents/certificate.ts; enforced
 * cross-language by test/parity.test.ts, which compiles this file and executes
 * it in a local EVM):
 *   ballot digest = keccak256(abi.encode(factHash, policyId, round, agentId, vote))
 *   cert hash     = keccak256(abi.encode("QUORUMPROOF_V1", factHash, policyId,
 *                                        decision, approvals, fleetSize))
 * Both use PADDED abi.encode (not encodePacked) so uint8 fields occupy full
 * 32-byte words exactly like ethers' AbiCoder. Signatures are EIP-191
 * personal_sign over the RAW 32-byte digest ("\x19Ethereum Signed Message:\n32").
 */
contract QuorumRegistry {
    struct Decision {
        bytes32 certHash;
        uint8 decision; // 0 = REJECT, 1 = EXECUTE
        uint8 approvals;
        uint8 fleetSize;
        uint64 timestamp;
    }

    /// @notice Groups submitDecision's parallel arrays for the verification
    ///         pass. NOTE: the 10-parameter external function requires
    ///         `viaIR: true` (legacy codegen hits "Stack too deep" with or
    ///         without the optimizer — measured with solc 0.8.28); the parity
    ///         test harness compiles with viaIR + optimizer 200.
    struct BallotBatch {
        bytes32 factHash;
        bytes32 policyId;
        bytes32[] agentIds;
        address[] signers;
        bytes32[] r;
        bytes32[] s;
        uint8[] v;
        uint8[] votes;
    }

    /// @notice agentId => registered control address (fleet roster, set by owner)
    mapping(bytes32 => address) public agentControl;
    /// @notice factHash => recorded decision
    mapping(bytes32 => Decision) public decisions;

    address public owner;

    event AgentRegistered(bytes32 indexed agentId, address indexed control);
    event DecisionRecorded(
        bytes32 indexed certHash,
        bytes32 indexed factHash,
        bytes32 policyId,
        uint8 decision,
        uint8 approvals,
        uint8 fleetSize
    );

    error BadQuorum();
    error BadSigner();
    error DuplicateSigner();
    error AlreadyRecorded();
    error NotOwner();

    constructor() {
        owner = msg.sender;
    }

    function registerAgent(bytes32 agentId, address control) external {
        if (msg.sender != owner) revert NotOwner();
        agentControl[agentId] = control;
        emit AgentRegistered(agentId, control);
    }

    /**
     * @notice Canonical ballot digest — the single source of truth for what an
     *         agent signs. MUST byte-match voteDigest() in
     *         src/agents/certificate.ts. Padded abi.encode: every field is one
     *         32-byte word (160-byte preimage).
     * @param round deliberation round (on-chain submissions bind round 2,
     *        the final post-debate ballots)
     */
    function ballotDigestOf(
        bytes32 factHash,
        bytes32 policyId,
        uint8 round,
        bytes32 agentId,
        uint8 vote
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(factHash, policyId, round, agentId, vote));
    }

    /**
     * @notice Canonical certificate hash — MUST byte-match certificateHash()
     *         in src/agents/certificate.ts (256-byte preimage; `approvals` IS
     *         a bound field).
     */
    function certificateHashOf(
        bytes32 factHash,
        bytes32 policyId,
        uint8 decision,
        uint8 approvals,
        uint8 fleetSize
    ) public pure returns (bytes32) {
        return keccak256(abi.encode("QUORUMPROOF_V1", factHash, policyId, decision, approvals, fleetSize));
    }

    /**
     * @notice Record a fleet decision over an Attestcoin-verified fact.
     * @param factHash keccak(chainKey, headerNumber, txHash, verified) from the attestation pipeline
     * @param policyId keccak of the lending policy the fleet deliberated against
     * @param decision 0 = REJECT, 1 = EXECUTE (executed only if quorum is met)
     * @param agentIds keccak agent ids, parallel to the other arrays
     * @param signers  expected control addresses (empty entry = any address allowed)
     * @param r        EIP-191 signature r components
     * @param s        EIP-191 signature s components
     * @param v        EIP-191 signature v components (27/28)
     * @param votes    per-ballot vote (0 ABSTAIN, 1 APPROVE, 2 DENY), parallel array
     * @param requiredApprovals quorum threshold for EXECUTE
     * @return certHash keccak of the canonical certificate
     */
    function submitDecision(
        bytes32 factHash,
        bytes32 policyId,
        uint8 decision,
        bytes32[] calldata agentIds,
        address[] calldata signers,
        bytes32[] calldata r,
        bytes32[] calldata s,
        uint8[] calldata v,
        uint8[] calldata votes,
        uint8 requiredApprovals
    ) external returns (bytes32 certHash) {
        uint256 n = agentIds.length;
        if (n == 0 || n != signers.length || n != r.length || n != s.length || n != v.length || n != votes.length) {
            revert BadQuorum();
        }
        if (decisions[factHash].timestamp != 0) revert AlreadyRecorded();

        uint8 approvals = _verifyBallots(
            BallotBatch(factHash, policyId, agentIds, signers, r, s, v, votes)
        );

        // Quorum gate: EXECUTE requires the threshold; anything else records REJECT.
        uint8 effective = (approvals >= requiredApprovals && decision == 1) ? 1 : 0;

        certHash = certificateHashOf(factHash, policyId, effective, approvals, uint8(n));
        decisions[factHash] = Decision({
            certHash: certHash,
            decision: effective,
            approvals: approvals,
            fleetSize: uint8(n),
            timestamp: uint64(block.timestamp)
        });
        emit DecisionRecorded(certHash, factHash, policyId, effective, approvals, uint8(n));
    }

    /**
     * @dev Recovers and checks every ballot signer; reverts on the first bad
     *      ballot. On-chain submissions carry the ROUND-2 (final) ballots, so
     *      the digest binds round = 2 — matching Fleet.collectSigned(2, …).
     */
    function _verifyBallots(BallotBatch memory b) internal pure returns (uint8 approvals) {
        uint256 n = b.agentIds.length;
        address[] memory seen = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            bytes32 digest = ballotDigestOf(b.factHash, b.policyId, 2, b.agentIds[i], b.votes[i]);
            bytes32 ethDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
            address recovered = ecrecover(ethDigest, b.v[i], b.r[i], b.s[i]);
            if (recovered == address(0)) revert BadSigner();
            if (b.signers[i] != address(0) && recovered != b.signers[i]) revert BadSigner();
            for (uint256 j = 0; j < i; j++) {
                if (seen[j] == recovered) revert DuplicateSigner();
            }
            seen[i] = recovered;
            if (b.votes[i] == 1) approvals++;
        }
    }
}
