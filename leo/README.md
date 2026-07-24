# Aleo Integration Placeholder

The MVP uses a local mock proof boundary only. The next milestone will replace `lib/proof.ts` with an Aleo/Leo proof flow that proves the same invariant without revealing private exploit details.

Planned path:

1. Model the invariant `vault_balance >= total_claims`.
2. Encode private deltas as Leo private inputs.
3. Emit only public claim metadata and verification status.
4. Connect the adapter in `lib/aleo-adapter.ts`.
