# zkBugBounty

**zkBugBounty lets whitehats prove a bug exists without leaking the exploit.**

zkBugBounty is a privacy-first responsible disclosure protocol prototype on Aleo Testnet. It lets a whitehat prove that a DemoVault security invariant is broken, while keeping the witness, exploit path, proof-of-concept, triggering parameters, and reporter secret outside public storage and public UI.

- **Live DApp:** [aleo-gilt.vercel.app](https://aleo-gilt.vercel.app)
- **Aleo Program:** `zkbugbounty_7f3c92.aleo`
- **Network:** Aleo Testnet
- **Current program edition:** `1`

## Project Overview

### Problem Statement

Traditional vulnerability-bounty workflows force researchers to disclose an exploit or a detailed proof-of-concept before a project has verified, triaged, and patched the issue. That creates a difficult tradeoff: a credible report may leak the exact information an attacker needs, while a minimal report may be impossible for the project to trust or prioritize.

### Solution

zkBugBounty separates **proof of impact** from **exploit disclosure**:

- A whitehat prepares a private DemoVault witness locally and proves a selected security invariant can be violated.
- The Aleo Program records only public commitments, a verified Claim Receipt, and a one-time Nullifier.
- The project owner can follow a responsible-disclosure state machine without exposing exploit details to the public registry.
- Edition 1 adds real Credits-backed bounty escrow, reward locking, encrypted-detail attestation, patch marking, payout, refund guards, and replay protection.

The public result proves that a claim is valid. It does not publish how to reproduce the vulnerability.

## Blockchain Relevance

| Area | How zkBugBounty uses it |
| --- | --- |
| Aleo / Leo | A Leo 4.4 Program enforces bounty, claim, disclosure, and escrow transitions on Aleo Testnet. |
| Zero-knowledge boundary | Private witness data stays on the device-side proving boundary; only commitments and public receipt fields enter the protocol. |
| On-chain provenance | `bounties`, `claim_receipts`, `nullifiers`, and escrow mappings create a public, independently verifiable protocol trail. |
| Replay protection | The Program Final rejects reused Nullifiers and operation markers, including duplicate payout and funding attempts. |
| Real Credits escrow | Edition 1 moves funding, reward release, and refund accounting into the Program instead of a frontend-only status model. |

## Hackathon Value

zkBugBounty is a practical privacy-native security product rather than a generic proof demo. The end-to-end journey is:

```text
Project Owner creates bounty
        -> Whitehat proves a DemoVault invariant break privately
        -> Aleo Claim Receipt + Nullifier are written publicly
        -> Owner locks reward and requests encrypted details
        -> Whitehat attests encrypted details for the owner
        -> Owner marks patched and releases Credits reward
        -> Anyone verifies the public protocol state
```

The DApp has an explicit Demo Mode for product walkthroughs and a Real Mode that uses Leo Wallet for user-approved Testnet transactions. Real Mode never silently falls back to Mock data or browser persistence.

## Technical Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    Next.js 16 Browser DApp                   │
│  Public registry reads ────────> Provable public API          │
│  Leo Wallet ── user approves ──> Aleo Testnet transaction     │
└───────────────┬───────────────────────────────┬──────────────┘
                │                               │
     device-only private boundary          public protocol state
                │                               │
                ▼                               ▼
        Private DemoVault witness      zkbugbounty_7f3c92.aleo
        reporter secret                 Bounty / Claim Receipt / Nullifier
        encrypted disclosure details    Escrow / payout / triage mappings
```

Private data is never sent to `/api/aleo/prove`; that endpoint intentionally returns HTTP `410` in Real Mode. The server does not prove, store, or log private witnesses.

## Core Technology Stack

| Layer | Technology |
| --- | --- |
| Smart contract | Leo 4.4, Aleo Testnet, `zkbugbounty_7f3c92.aleo` |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS |
| Wallet | Leo Wallet Adapter with Aleo Testnet minimum permissions |
| Public verification | Provable public API, typed mapping parsers, bounded transaction polling |
| Proof demo | Device-side MockVault invariant evaluator with four DemoVault rules |
| Deployment | Vercel Production |

## Aleo Program

The canonical Program source is [`leo/bug_proof/src/main.leo`](leo/bug_proof/src/main.leo).

### Public Registries

| Mapping | Purpose |
| --- | --- |
| `bounties` | Public Bounty configuration and Active/Closed state |
| `claim_receipts` | Verified public Claim Receipt metadata |
| `nullifiers` | One-time claim replay protection |
| `bounty_escrows` | Credits funding, available balance, locked, paid, and refunded amounts |
| `claim_payouts` | Reward recipient and terminal payout state |
| `claim_triage_states` | Responsible-disclosure state without exploit contents |
| `escrow_operation_markers` | Funding, lock, release, refund, patch, and disclosure replay guards |

### Key Public Entrypoints

| Entrypoint | Purpose |
| --- | --- |
| `create_bounty` | Registers a public bounty with scope, rule, tiers, deadline, and owner. |
| `submit_claim` / `submit_claim_v2` | Verifies the invariant result and writes a Claim Receipt plus Nullifier. |
| `fund_bounty_v2` | Funds a bounty escrow with Aleo Credits. |
| `lock_reward_v2` | Reserves the rule-and-severity reward for a verified claim. |
| `request_disclosure` | Moves a claim into the owner-only encrypted disclosure phase. |
| `attest_encrypted_details` | Records a public package commitment, never the encrypted plaintext. |
| `mark_patched` | Records completion of the remediation stage. |
| `release_reward_v2` | Releases locked Credits to the verified whitehat. |
| `refund_bounty_v2` | Allows one guarded refund only when the bounty has no unresolved obligations. |

Legacy economic entrypoints are intentionally fail-closed. Edition 1 actions use the `_v2` Credits-aware flow.

## Security and Privacy Boundaries

- Private Witness, reporter secret, hidden deltas, private call sequence, proof-of-concept, exploit path, and triggering parameters are not stored in the public claim, browser persistence, URL, logs, or public UI.
- `canViewPrivateWitness()` is always `false`: the system never saves a private witness to retrieve later.
- Public errors are normalized to a code, short reason, practical recovery advice, and a public transaction ID when one exists.
- HTTP `404` during transaction indexing is treated as `not_indexed_yet`, never as a rejected transaction.
- Pending Wallet requests are rate-bounded, cancelable on component unmount, and protected against duplicate submission.

## Local Development

### Requirements

- Node.js 20+
- npm
- Leo 4.4 for Program compilation (optional for frontend-only work)
- Leo Wallet browser extension for manual Real Mode transactions

### Run the DApp

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Validate the Repository

```bash
npm run test
npm run lint
npm run build
```

Compile the canonical Leo Program in WSL or Linux:

```bash
cd leo/bug_proof
leo build
```

### Public Testnet Verification

These commands only use public endpoints. They do not request a key, sign a transaction, or broadcast.

```bash
npm run verify:testnet-edition-1
npm run smoke:assistant -- template --step fund_bounty_v2
npm run smoke:identifiers
```

For a public mapping lookup:

```bash
npm run verify:testnet-mapping -- --mapping bounties --key <bounty_id_field>
```

## Demo Flow

1. Open **Create Bounty** and select one of the four DemoVault safety rules.
2. In **Submit Proof**, use Demo Mode for a safe walkthrough or Real Mode for a manually approved Leo Wallet flow.
3. Read verified receipts in **Public Claims**; they show public metadata only.
4. Use **Triage** to inspect the responsible-disclosure sequence and public operation markers.
5. Follow the [Edition 1 smoke test plan](docs/testnet-edition-1-smoke-test-plan.md) for any manual Testnet acceptance run.

## DemoVault Rules

1. `vaultBalance >= totalClaims`
2. `totalClaims <= totalDeposits`
3. `reservedRewards <= vaultBalance`
4. `withdrawLimit <= vaultBalance`

These rules are intentionally fictional protocol invariants for a safe product demonstration. zkBugBounty does not scan real contracts, publish real exploit instructions, or provide an attack tool.

## Operations

- [Edition 1 production runbook](docs/edition-1-production-runbook.md)
- [Edition 1 manual smoke-test plan](docs/testnet-edition-1-smoke-test-plan.md)

The runbook covers stale frontend deployment, wallet connection failures, wrong network, rejected transactions, indexing delay, mapping verification, and frontend-only rollback. An Aleo Program edition cannot be rolled back from the frontend.

## Roadmap

### Completed

- Aleo Testnet Program deployment and Edition 1 upgrade
- Wallet-signed bounty creation and claim submission
- Public Bounty, Claim Receipt, Nullifier, and Escrow registry reads
- Duplicate Nullifier rejection on Testnet
- Credits escrow, release, refund, and replay guards validated on Local Devnode
- Production deployment, public Edition 1 verifier, and manual Smoke tooling

### Next

- Human-run Testnet Credits escrow acceptance flow with fresh test data
- Broader invariant libraries beyond DemoVault
- Formal protocol review and external security audit
- Production-grade encrypted disclosure delivery between verified participants

## License

See [LICENSE](LICENSE).
