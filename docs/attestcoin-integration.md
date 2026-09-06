# Attestcoin Protocol integration — technical documentation

This is the "technical documentation detailing your setup and explaining how the
project uses the Attestcoin Protocol" required by the BUIDL CTC 2026 Fall brief.

## Environments and endpoints (all public)

| What | Value |
|---|---|
| Creditcoin CC3 testnet RPC | `https://rpc.cc3-testnet.creditcoin.network` (chainId `102031` / `0x18e8f`) |
| Attestcoin Proof Builder (testnet) | `https://proof-gen-api.cc3-testnet.creditcoin.network` |
| REST: attested height | `GET /api/v1/attested-height/{chainKey}` |
| REST: proof by tx | `GET /api/v1/proof-by-tx/{chainKey}/{txHash}` |
| BlockProver precompile | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo precompile | `0x0000000000000000000000000000000000000FD3` |
| EvmV1Decoder library (testnet) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| SDK | `@gluwa/usc-sdk@0.18.0` (npm, peer: `ethers@^6`) |
| Docs | https://docs.attestcoin.org (chains/environments, guided tutorials, SDK) |

Source-chain keys in the CC3 **testnet** registry (not EVM chainIds):
`1` = Ethereum Sepolia, `3` = **Ethereum Mainnet**. QuorumProof uses chainKey 3:
the CC3 testnet attests real mainnet blocks (observed live: attested height
25,920,130 vs mainnet head within minutes), so a solo dev can prove *real economic
facts* without bridging testnet funds anywhere.

## Setup

```bash
npm install        # official npm registry only; lockfile committed
npm run build      # tsc --strict, green
npm run verify-live -- <txHash> [chainKey]   # live proof of the integration
```

No secrets are required for anything live. The only env vars ever read are
optional (`QUORUMPROOF_REGISTRY_ADDRESS`, `QUORUMPROOF_SUBMITTER_KEY`,
`QUORUMPROOF_LLM_*`) — see `.env.example`.

## How the project uses the protocol (four touchpoints)

1. **Proof generation** — `proofProvider.service.ProofBuilder(chainKey, apiUrl).getProof(txHash)`
   returns the inclusion proof (transaction Merkle path in the source block's tx
   trie) and the continuity proof (that block links to Creditcoin's attestation
   chain). `src/attest/gateway.ts`.

2. **On-chain verification in Creditcoin's trust domain** —
   `blockProver.PrecompileBlockProver(provider).verifySingle(chainKey, headerNumber,
   txBytes, merkleProof, continuityProof)`. This is a `staticCall` against the
   BlockProver precompile (`0x…FD2`) — an actual read of Creditcoin state, which is
   why it needs no gas and no key. A `false` result throws; unverified data never
   reaches the agents.

3. **On-chain decoding** — `utils.decoder.decodeEvmV1Transaction(txBytes, decoderContract)`
   calls the deployed `EvmV1Decoder` library (eth_call) to decode the ABI-wrapped
   verified transaction into `commonTx` (from/to/value/calldata) + receipt status.
   The fact hash that binds the whole decision is
   `keccak256(abi.encode(chainKey, headerNumber, txHash, verified))`.

4. **Writing decisions back (QuorumRegistry)** — `contracts/QuorumRegistry.sol`
   records the fleet's certificate on CC3: it recovers every ballot signature
   (EIP-191 over the canonical ballot digest, byte-exact with
   `src/agents/certificate.ts`), rejects duplicates/unregistered signers, applies
   the quorum threshold, and emits `DecisionRecorded`. Submission is a real
   transaction and therefore faucet-gated; the local-enforcement path (signature
   audit + certificate) is complete and clearly labeled when no registry is
   configured.

## Digest formats (interop contract)

Ballot digest (identical in TS and Solidity):

```
keccak256(abi.encode(
  bytes32 factHash,     // from the attestation pipeline
  bytes32 policyId,     // keccak256(abi.encode(lender, expectedAmount, tolerances...))
  uint8   round,        // 2 (final ballots)
  bytes32 agentIdHash,  // keccak256(utf8(agentId))
  uint8   voteByte      // 0 ABSTAIN, 1 APPROVE, 2 DENY
))
```

Agents sign `personal_sign(digest)` (EIP-191). The contract recomputes
`keccak256("\x19Ethereum Signed Message:\n32" ++ digest)` and `ecrecover`s.
Certificate hash: `keccak256(abi.encode("QUORUMPROOF_V1", factHash, policyId,
decision, approvals, fleetSize))`.

## Verification performed (2026-09-06)

- `curl` CC3 testnet: `eth_chainId` → `0x18e8f`; `eth_blockNumber` → live.
- `curl` proof-builder: attested height for chainKey 3 → live and advancing.
- `npm run verify-live` → PASS: proof generated, precompile verified `true`,
  decoded 3.5999664 ETH transfer with receipt status 1.
- `npm run demo` → EXECUTE 3/3 (matching repayment), REJECT 1/3 (unrelated
  inflow, signed dissent), all ballot signatures locally audited.
