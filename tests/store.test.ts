import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createInitialDemoState,
  createPublicClaimFromProof,
  transitionClaim,
} from "../lib/store.ts";

test("creates public claim metadata without private proof fields", () => {
  const state = createInitialDemoState();
  const claim = createPublicClaimFromProof(state, {
    bountyId: "bounty-001",
    bugType: "Vault accounting bypass",
    claimHash: "zkclaim_deadbeefdeadbeef",
    severity: "Critical",
    verified: true,
  });

  assert.equal(claim.exploitDetailsVisible, false);
  assert.equal(claim.proofStatus, "Verified");
  assert.equal(claim.disclosureStatus, "NotRequested");
  assert.equal(claim.payoutStatus, "Unfunded");
  assert.equal(JSON.stringify(claim).includes("hidden_delta_balance"), false);
  assert.equal(JSON.stringify(claim).includes("hidden_delta_claims"), false);
  assert.equal(JSON.stringify(claim).includes("PoC"), false);
});

test("supports the required triage status flow", () => {
  const state = createInitialDemoState();
  const claim = createPublicClaimFromProof(state, {
    bountyId: "bounty-001",
    bugType: "Vault accounting bypass",
    claimHash: "zkclaim_deadbeefdeadbeef",
    severity: "Critical",
    verified: true,
  });

  const locked = transitionClaim(claim, "RewardLocked");
  assert.equal(locked.proofStatus, "Verified");
  assert.equal(locked.payoutStatus, "RewardLocked");

  const requested = transitionClaim(locked, "DetailsRequested");
  assert.equal(requested.disclosureStatus, "Requested");

  const shared = transitionClaim(requested, "EncryptedDetailsShared");
  assert.equal(shared.disclosureStatus, "EncryptedDetailsShared");

  const patched = transitionClaim(shared, "Patched");
  assert.equal(patched.disclosureStatus, "Patched");

  const paid = transitionClaim(patched, "Paid");
  assert.equal(paid.payoutStatus, "Paid");
});

test("rejects out-of-order triage transitions", () => {
  const state = createInitialDemoState();
  const claim = createPublicClaimFromProof(state, {
    bountyId: "bounty-001",
    bugType: "Vault accounting bypass",
    claimHash: "zkclaim_deadbeefdeadbeef",
    severity: "Critical",
    verified: true,
  });

  assert.throws(() => transitionClaim(claim, "Paid"), /released after patching/);
});
