# zkBugBounty MVP

zkBugBounty lets whitehats prove a bug exists without leaking the exploit.

This is a hackathon-grade Next.js App Router demo. It models a zero-knowledge bug bounty flow with local mock state, a real mock invariant check, and public claim metadata that never includes private exploit details.

## Demo Flow

1. Create a bounty with the fixed rule `vault_balance >= total_claims`.
2. Submit private proof inputs on `/submit-proof`.
3. Generate a mock proof that only outputs `claimHash`, `severity`, `bugType`, and `verified`.
4. Publish a verified public claim.
5. Triage through `Verified -> RewardLocked -> DetailsRequested -> Patched -> Paid`.
6. View public claims with exploit details hidden.

## Privacy Boundary

Private proof inputs stay inside the submit page state and are not written to the store, mock data, URL, localStorage, sessionStorage, logs, or public claim metadata.

## Commands

```bash
npm run test
npm run lint
npm run build
```
