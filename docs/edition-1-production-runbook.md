# Edition 1 Production Runbook

## Scope

This runbook covers the zkBugBounty Edition 1 frontend and public Aleo Testnet reads. It does not authorize wallet access, signing, broadcasting, a Program upgrade, or a rollback of on-chain state. Program ID: `zkbugbounty_7f3c92.aleo`; network: Aleo Testnet.

## 1. Page Shows the Wrong Edition

Open `/api/aleo/deployment` and `/api/aleo/escrow` with `Cache-Control: no-cache`. Verify the public Program source, `latest_edition`, Program ID, and Upgrade transaction separately. Do not infer deployment failure from a single unavailable endpoint. If the public endpoints report Edition 1 while the UI reports Edition 0, treat the frontend deployment as stale.

## 2. Vercel Is Ready but the Page Is Cached

Compare a normal request with a no-cache request. Inspect `cache-control`, `age`, and `x-vercel-cache`. Confirm the route is dynamic and uses `no-store`; then redeploy the verified frontend commit. Do not use a hardcoded Edition fallback to hide a public endpoint failure.

## 3. Wallet Cannot Connect

Confirm that Leo Wallet is installed, unlocked, and its Connected sites entry permits the production URL. Use a supported Chrome or Edge profile. The app must remain disconnected when the extension is unavailable; do not enter credentials into the page.

## 4. Wrong Network

The expected Wallet network is Aleo Testnet (`testnetbeta`). Switch the extension back to Testnet, refresh the public Preview, and reconnect. Never sign a Preview while the app reports Wrong Network.

## 5. User Rejects Connection or Signing

A rejected connection returns to the disconnected state. A rejected signing request is `SIGNATURE_REJECTED`, produces no transaction ID, and may be requested again only after the user rechecks the public Preview. The application must not retry automatically.

## 6. RPC Timeout or Broadcast Failure

Show `BROADCAST_FAILED` or an unavailable lookup state with a short message. Recheck public endpoint availability, regenerate the Preview, and request a new manual signature only after confirming no transaction ID or operation marker exists. Never repeat a signing request automatically.

## 7. Transaction Pending

Keep the public `at1...` Transaction ID and use `/api/aleo/transactions/[transactionId]` or the Smoke assistant. The client polls with a bounded retry count and stops when unmounted. Pending and HTTP 404 mean indexing may be delayed; neither is a rejected transaction.

## 8. Transaction Indexing 404

Classify a 404 as `not_indexed_yet` during the polling window. After the bounded window it is `not_found_after_timeout`. A Fee Transaction 404 is `INDEX_UNAVAILABLE` when the primary Upgrade transaction is confirmed; it must not turn the Upgrade status red or rejected.

## 9. Transaction Rejected

Only show Rejected when a public endpoint explicitly reports a rejected, aborted, or failed transaction. Display a redacted public summary, keep the prior Mapping state, and do not resubmit the same operation marker.

## 10. Mapping Is Not Immediately Updated

Use `npm run verify:testnet-mapping -- --mapping <name> --key <field>` after a confirmed transaction. `NOT_SET` is an absent Mapping value, `INDEX_DELAY` is an explicitly declared indexing window, and `HTTP_ERROR` is a transport failure. Do not treat an absent Mapping as a successful transition.

## 11. Preventing Duplicate Submission

Wallet actions are disabled while awaiting signature, broadcasting, pending, or accepted. The public operation marker appears in the Preview. Do not resubmit the same operation while it is pending; on refresh, only public `at1...` IDs are restored for polling.

## 12. Frontend Rollback

A frontend rollback means promoting a previously verified Vercel deployment or redeploying its Git commit. First document the target deployment, confirm its public Program ID and network configuration, then verify `/api/aleo/deployment` and `/api/aleo/escrow` without a wallet.

## 13. On-chain Rollback Is Not Available

Aleo Program Edition 1 cannot be rolled back by the frontend. Do not broadcast another Edition 1 upgrade. Any future Program action requires a separate compatibility review, fresh local E2E evidence, public fee review, and explicit user approval.

## 14. Manual Smoke-Test Recovery

Use `npm run smoke:identifiers` to obtain unique public markers, then `npm run smoke:assistant -- template --step <step>` for the expected transition. The user manually signs each transaction and passes only the public transaction ID and public Mapping keys back to the assistant. Stop on wrong Program ID, wrong network, insufficient balance, pending prior transaction, existing marker, or an unexpected Mapping value.