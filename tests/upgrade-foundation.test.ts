import assert from "node:assert/strict";
import { test } from "node:test";

import { CANONICAL_ALEO_PROGRAM_ID } from "../lib/aleo-program.ts";
import { createInitialDemoState } from "../lib/store.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import { createPersistedDemoState, hydratePersistedDemoState, parsePersistedDemoState } from "../lib/persistence.ts";
import { createAleoProgramEngine, createMockVaultEngine } from "../lib/proof-engines/index.ts";
import { getClaimWorkflowGuidance } from "../lib/state-machine.ts";

test("privacy guard normalizes snake_case and punctuation variants", () => {
  for (const key of [
    "hidden_delta_reserved_rewards",
    "hidden-delta-withdraw-amount",
    "PRIVATE_WITNESS",
    "private.state.values",
  ]) {
    assert.throws(() => assertNoPrivateFields({ [key]: "sealed" }), /Sensitive field/);
  }
});

test("persisted demo state contains public workflow data only", () => {
  const state = createInitialDemoState();
  const persisted = createPersistedDemoState(state);

  assert.deepEqual(Object.keys(persisted).sort(), [
    "bounties",
    "claimReceipts",
    "claims",
    "disclosurePackages",
    "nullifierRecords",
    "publicClaimRegistry",
    "triageActions",
    "version",
  ]);
  assertNoPrivateFields(persisted);

  const restored = hydratePersistedDemoState(state, persisted);
  assert.equal(restored.currentActor.role, state.currentActor.role);
  assert.equal(restored.claims.length, persisted.claims.length);
});

test("stale persisted demo state missing newer public collections is ignored", () => {
  const state = createInitialDemoState();
  const staleState = {
    version: 1,
    bounties: state.bounties,
    claims: state.claims,
  };

  assert.equal(parsePersistedDemoState(JSON.stringify(staleState)), null);
});
test("malformed persisted public records are ignored before any page can render them", () => {
  const state = createInitialDemoState();
  const malformed = {
    ...createPersistedDemoState(state),
    bounties: [{ id: "missing-required-fields" }],
  };

  assert.equal(parsePersistedDemoState(JSON.stringify(malformed)), null);
  assert.deepEqual(hydratePersistedDemoState(state, malformed as never), state);
});
test("proof engines expose rule capabilities", () => {
  const mock = createMockVaultEngine();
  const aleo = createAleoProgramEngine();

  assert.equal(mock.supportsRule("withdraw-limit-safety"), true);
  assert.equal(aleo.supportsRule("vault-accounting-safety"), true);
  assert.equal(aleo.supportsRule("claims-vs-deposits"), true);
  assert.match(
    aleo.getSupportMessage("claims-vs-deposits"),
    new RegExp(CANONICAL_ALEO_PROGRAM_ID.replace(".", "\\.")),
  );
});

test("workflow guidance explains the next action and required role", () => {
  const claim = createInitialDemoState().claims[0];
  const guidance = getClaimWorkflowGuidance(claim);

  assert.equal(guidance.nextAction, "RewardLocked");
  assert.equal(guidance.requiredRole, "ProjectOwner");
  assert.equal(guidance.terminal, false);
});
