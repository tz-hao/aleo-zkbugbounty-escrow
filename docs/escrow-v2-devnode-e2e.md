# Escrow v2 Local Devnode E2E

Status: `BLOCKED_SECURITY_INPUT`

This harness is intentionally limited to a disposable Leo Devnode at
`http://127.0.0.1:3030`. It rejects every other endpoint before it starts a
process or submits a transaction. It never sends a Testnet transaction.

## Why an interactive local key is required

Leo 4.0.2 requires `PRIVATE_KEY` for `leo devnode start`; it does not create or
silently select an account. The harness therefore reads three local-only
accounts from the interactive terminal. They are held only by the shell process
and cleared on exit. They must not be Testnet, Wallet, or production Admin
credentials.

The main program has a fixed Testnet admin and arbiter address. To test the
actual edition-0 to edition-1 upgrade without that real credential, the
harness applies an ephemeral public-address-only patch to its two detached
worktrees. It restores both source files when it exits. The production worktree,
canonical candidate tag, Testnet program, and mappings are not modified.

## Isolated inputs

- Baseline worktree: `../aleo-devnode-baseline` at `pre-escrow-upgrade`
- Candidate worktree: `../aleo-devnode-candidate` at
  `escrow-v2-upgrade-candidate`
- Fresh ledger: `../aleo-devnode-ledger`, supplied to Leo 4.0.2 with `--home`

Leo 4.0.2 does not expose `--storage` or `--clear-storage`; the harness removes
only this exact dedicated ledger directory after validating its resolved path.

## Run locally

From WSL, in the main worktree:

```bash
npm run test:escrow-devnode
```

Enter only disposable local-devnode keys and their public addresses when
prompted. The report is written to the ignored path
`local-e2e-results/escrow-v2-devnode-report.json`; it contains transaction IDs,
mapping keys, and status only. It does not contain keys or private witness
inputs.

## Current automated scope

The harness prepares a fresh local ledger, deploys Baseline edition 0, creates
and verifies public v1 Registry state, upgrades to Candidate edition 1, verifies
v1 data preservation, then submits real local transactions that verify v1
Escrow isolation. It stops without marking Credits E2E complete until the local
credentials are entered and the resulting public Devnode transaction evidence
is inspected.

`COMPLETED_LOCAL_DEVNODE` must not be used until the happy path, refund path,
and full negative matrix have all been observed as Devnode transactions.
