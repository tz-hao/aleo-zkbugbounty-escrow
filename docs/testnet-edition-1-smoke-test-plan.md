# Testnet Edition 1 Manual Smoke Test Plan

## Scope and Safety Boundary

This plan is for a user-controlled Testnet session after edition 1 activation. Each transaction requires manual wallet confirmation. Use fresh public test values only. Do not place credentials, private witness material, exploit details, or recipient-sensitive data in this document, browser storage, URL parameters, or transaction notes.

Before every action, confirm the wallet network is Aleo Testnet, the Program ID is `zkbugbounty_7f3c92.aleo`, and the transaction preview names the expected function. After every accepted action, verify the named public Mapping state. A rejected action must not be retried automatically.

## Happy Path

| Step | Function | Public input format | Expected result | Required public state assertion |
| --- | --- | --- | --- | --- |
| 1 | `create_bounty` | Bounty field identifiers, scope/rule fields, reward tier `u64` values, deadline | accepted | Bounty Registry exists with protocol version 2. |
| 2 | `fund_bounty_v2` | `bounty_id: field`, `amount: u64`, `funding_marker: field` | accepted | `bounty_escrows` available balance increases by amount; marker exists. |
| 3 | `submit_claim_v2` | Wallet-generated public claim commitments and protocol-v2 public literals only | accepted | Claim Receipt, Reporter, Triage, and claim-count mappings match the new Claim. |
| 4 | `lock_reward_v2` | `bounty_id: field`, `claim_hash: field`, `reporter: address`, `amount: u64`, `lock_marker: field` | accepted | Triage state is RewardLocked; escrow available/locked balances update once. |
| 5 | `request_disclosure` | `bounty_id: field`, `claim_hash: field`, `request_marker: field` | accepted | Triage state advances to DetailsRequested. |
| 6 | `attest_encrypted_details` | `bounty_id: field`, `claim_hash: field`, `package_hash: field`, `share_marker: field` | accepted | Triage state advances to encrypted-details attested; only package hash is public. |
| 7 | `mark_patched` | `bounty_id: field`, `claim_hash: field`, `patched_marker: field` | accepted | Triage state advances to Patched. |
| 8 | `release_reward_v2` | `bounty_id: field`, `claim_hash: field`, `reporter: address`, `amount: u64`, `release_marker: field` | accepted | `claim_payouts` is Paid; escrow and recipient public balance deltas match once. |

## Expected Rejections

| Case | Invocation | Expected rejection assertion |
| --- | --- | --- |
| Legacy funding | `fund_bounty` | fail-closed; no escrow balance or marker change. |
| Legacy lock | `lock_reward` | fail-closed; no triage or escrow change. |
| Legacy refund | `refund_bounty` | fail-closed; no escrow or owner balance business change. |
| Funding replay | repeat `fund_bounty_v2` marker | rejected; escrow and marker state unchanged. |
| Lock replay | repeat `lock_reward_v2` marker | rejected; locked amount and triage state unchanged. |
| Release replay | repeat `release_reward_v2` marker | rejected; payout and recipient business balance unchanged. |
| Refund replay | repeat `refund_bounty_v2` marker | rejected; escrow and owner business balance unchanged. |
| Unauthorized reject | call `reject_claim` without arbiter authority | rejected; triage, payout, and escrow state unchanged. |

## Completion Criteria

Record only public transaction identifiers, accepted/rejected status, and Mapping assertions. Do not report raw credential material, private witness inputs, encrypted disclosure contents, full signed payloads, or proofs.
## Manual Preflight Checklist

- Production URL is `https://aleo-gilt.vercel.app` and the public deployment panel reports Program ID `zkbugbounty_7f3c92.aleo`.
- Public endpoints report edition `1`, Escrow v2 `Live`, and `ProgramUpgradeRequired` is false.
- Shield is connected by the user only and the selected network is Aleo Testnet.
- Confirm the available public Testnet Credits balance before every step and use the smallest approved test amount.
- Run `npm run smoke:identifiers` without `--offline`; retain the generated public markers for this single session.
- Generate a fresh public Transaction Preview for each action. The user alone approves every Wallet prompt.
- Wait for confirmed status and all expected public Mapping checks before moving to the next step.

## Stop Conditions

Stop immediately and do not request a Wallet signature when the Program ID, network, or edition differs from the expected public values; available balance is insufficient; a required Mapping precondition is absent or mismatched; an operation marker already exists; a prior transaction remains pending; or public RPC status is unavailable. Resolve the public-read discrepancy before generating a new Preview.

## Public Verification Commands

```bash
npm run verify:testnet-edition-1
npm run smoke:identifiers
npm run smoke:assistant -- template --step fund_bounty_v2
npm run verify:testnet-mapping -- --mapping bounty_escrows --key <bounty_id_field>
```

These commands do not connect a wallet, create a signature, generate a proof, or broadcast a transaction.
