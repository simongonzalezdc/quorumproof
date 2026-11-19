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
 *  - The DECISION is what this contract enforces — and every part of it is
 *    derived from committed on-chain state, never from caller arguments:
 *      * MEMBERSHIP: each ballot names an agentId; the expected signer is the
 *        owner-registered control address for that agentId (agentControl).
 *        A ballot from an unregistered agent reverts NotRegistered; a
 *        signature from any other key reverts BadSigner. There is no
 *        caller-supplied signers[] array — the roster cannot be self-asserted.
 *      * THRESHOLD: the quorum threshold for a policy is the owner-committed
 *        value policyQuorum[policyId] (set via registerPolicy). A submitter
 *        cannot lower, raise, or skip it; an unregistered policy reverts
 *        PolicyNotRegistered.
 *      * OUTCOME: decision = (approvals >= threshold) ? EXECUTE : REJECT.
 *        There is no decision parameter — a fleet that did not meet quorum
 *        records REJECT no matter what the submitter intended.
 *  - Ballots must bind the exact factHash/policyId/round, signers must be
 *    distinct, and a factHash records exactly one decision.
 *  - The owner (deployer) is the trust root for the roster and the policy
 *    thresholds, exactly as for the underlying fact attestation pipeline.
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
    ///         pass, keeping the stack shallow. The test harness still
    ///         compiles with `viaIR: true` + optimizer (measured with solc
    ///         0.8.28; kept for headroom on the 7-parameter function).
    struct BallotBatch {
        bytes32 factHash;
        bytes32 policyId;
        bytes32[] agentIds;
        bytes32[] r;
        bytes32[] s;
        uint8[] v;
        uint8[] votes;
    }

    /// @notice agentId => registered control address (fleet roster, set by owner)
    mapping(bytes32 => address) public agentControl;
    /// @notice policyId => owner-committed quorum threshold (0 = not registered)
    mapping(bytes32 => uint8) public policyQuorum;
    /// @notice factHash => recorded decision
    mapping(bytes32 => Decision) public decisions;

    address public owner;

    event AgentRegistered(bytes32 indexed agentId, address indexed control);
    event PolicyRegistered(bytes32 indexed policyId, uint8 requiredApprovals);
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
    error NotRegistered(bytes32 agentId);
    error PolicyNotRegistered(bytes32 policyId);
    error BadThreshold();
    error ZeroControl();

    constructor() {
        owner = msg.sender;
    }

    function registerAgent(bytes32 agentId, address control) external {
        if (msg.sender != owner) revert NotOwner();
        if (control == address(0)) revert ZeroControl();
        agentControl[agentId] = control;
        emit AgentRegistered(agentId, control);
    }

    /**
     * @notice Commit the quorum threshold for a policy. Owner-only; the value
     *         lives in committed storage, so a submitDecision caller can never
     *         lower or supply it. requiredApprovals must be >= 1 — a zero
     *         threshold is exactly the "EXECUTE with zero approvals" hole and
     *         is unrepresentable here.
     */
    function registerPolicy(bytes32 policyId, uint8 requiredApprovals) external {
        if (msg.sender != owner) revert NotOwner();
        if (requiredApprovals == 0) revert BadThreshold();
        policyQuorum[policyId] = requiredApprovals;
        emit PolicyRegistered(policyId, requiredApprovals);
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
     *         Membership (agentControl), threshold (policyQuorum) and the
     *         outcome are ALL derived on-chain — the only thing a caller
     *         supplies is the ballots themselves.
     * @param factHash keccak(chainKey, headerNumber, txHash, verified) from the attestation pipeline
     * @param policyId keccak of the lending policy the fleet deliberated against (must be registered)
     * @param agentIds keccak agent ids, parallel to the other arrays
     * @param r        EIP-191 signature r components
     * @param s        EIP-191 signature s components
     * @param v        EIP-191 signature v components (27/28)
     * @param votes    per-ballot vote (0 ABSTAIN, 1 APPROVE, 2 DENY), parallel array
     * @return certHash keccak of the canonical certificate
     */
    function submitDecision(
        bytes32 factHash,
        bytes32 policyId,
        bytes32[] calldata agentIds,
        bytes32[] calldata r,
        bytes32[] calldata s,
        uint8[] calldata v,
        uint8[] calldata votes
    ) external returns (bytes32 certHash) {
        uint256 n = agentIds.length;
        if (n == 0 || n != r.length || n != s.length || n != v.length || n != votes.length) {
            revert BadQuorum();
        }
        if (decisions[factHash].timestamp != 0) revert AlreadyRecorded();

        uint8 required = policyQuorum[policyId];
        if (required == 0) revert PolicyNotRegistered(policyId);

        uint8 approvals = _verifyBallots(BallotBatch(factHash, policyId, agentIds, r, s, v, votes));

        // Quorum gate — DERIVED, never claimed: EXECUTE iff the recovered
        // approvals meet the owner-committed threshold for this policy.
        uint8 effective = approvals >= required ? 1 : 0;

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
     *      The expected signer for each ballot is read from the on-chain
     *      roster (agentControl), never from calldata.
     */
    function _verifyBallots(BallotBatch memory b) internal view returns (uint8 approvals) {
        uint256 n = b.agentIds.length;
        address[] memory seen = new address[](n);
        for (uint256 i = 0; i < n; i++) {
            bytes32 digest = ballotDigestOf(b.factHash, b.policyId, 2, b.agentIds[i], b.votes[i]);
            bytes32 ethDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
            address recovered = ecrecover(ethDigest, b.v[i], b.r[i], b.s[i]);
            if (recovered == address(0)) revert BadSigner();
            // MEMBERSHIP: expected signer comes from the owner-set roster.
            // Unknown agentId => NotRegistered; any other signing key => BadSigner.
            address expected = agentControl[b.agentIds[i]];
            if (expected == address(0)) revert NotRegistered(b.agentIds[i]);
            if (recovered != expected) revert BadSigner();
            for (uint256 j = 0; j < i; j++) {
                if (seen[j] == recovered) revert DuplicateSigner();
            }
            seen[i] = recovered;
            if (b.votes[i] == 1) approvals++;
        }
    }
}
