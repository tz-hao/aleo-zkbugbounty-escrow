import assert from "node:assert/strict";
import { test } from "node:test";

import { demoActors } from "../lib/roles.ts";
import {
  canCreateBounty,
  canRejectClaim,
  canReleaseBounty,
  canSubmitProof,
  canViewPrivateWitness,
  canViewTriage,
  canAddTriageNote,
} from "../lib/permissions.ts";
import { createInitialDemoState } from "../lib/store.ts";

test("role permissions match the responsible disclosure workflow", () => {
  const state = createInitialDemoState();
  const owner = demoActors.find((actor) => actor.role === "ProjectOwner")!;
  const whitehat = demoActors.find((actor) => actor.role === "Whitehat")!;
  const arbiter = demoActors.find((actor) => actor.role === "TriageArbiter")!;
  const publicUser = demoActors.find((actor) => actor.role === "PublicUser")!;
  const bounty = state.bounties[0];
  const claim = state.claims[0];

  assert.equal(canCreateBounty(owner), true);
  assert.equal(canSubmitProof(whitehat), true);
  assert.equal(canViewTriage(publicUser), false);
  assert.equal(canReleaseBounty(arbiter, bounty, claim), false);
  assert.equal(canAddTriageNote(arbiter, claim), true);
  assert.equal(canRejectClaim(owner, bounty, claim), false);
  assert.equal(canRejectClaim(owner, bounty, { ...claim, payoutStatus: "RewardLocked" }), true);

  for (const actor of demoActors) {
    assert.equal(canViewPrivateWitness(actor), false, `${actor.role} cannot view private witness`);
  }
});
