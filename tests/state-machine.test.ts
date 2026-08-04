import assert from "node:assert/strict";
import { test } from "node:test";

import { applyClaimAction, transitionProofStatus } from "../lib/state-machine.ts";
import { createInitialDemoState } from "../lib/store.ts";

test("proof status only transitions from Pending to a terminal proof state", () => {
  assert.equal(transitionProofStatus("Pending", "Verified"), "Verified");
  assert.equal(transitionProofStatus("Pending", "Invalid"), "Invalid");

  assert.throws(() => transitionProofStatus("Verified", "Pending"), /Proof status is final/);
  assert.throws(() => transitionProofStatus("Invalid", "Verified"), /Proof status is final/);
  assert.throws(() => transitionProofStatus("Pending", "Pending"), /Unsupported proof transition/);
});

test("strict triage flow requires each prior state", () => {
  const claim = createInitialDemoState().claims[0];

  assert.throws(() => applyClaimAction({ ...claim, proofStatus: "Pending" }, "RewardLocked"));

  const locked = applyClaimAction(claim, "RewardLocked");
  assert.equal(locked.payoutStatus, "RewardLocked");

  const requested = applyClaimAction(locked, "DetailsRequested");
  assert.equal(requested.disclosureStatus, "Requested");

  const shared = applyClaimAction(requested, "EncryptedDetailsShared");
  assert.equal(shared.disclosureStatus, "EncryptedDetailsShared");

  const patched = applyClaimAction(shared, "Patched");
  assert.equal(patched.disclosureStatus, "Patched");

  const paid = applyClaimAction(patched, "Paid");
  assert.equal(paid.payoutStatus, "Paid");
});

test("paid, invalid, and rejected claims cannot continue payout flow", () => {
  const claim = createInitialDemoState().claims[0];
  const paid = applyClaimAction(
    applyClaimAction(applyClaimAction(applyClaimAction(applyClaimAction(claim, "RewardLocked"), "DetailsRequested"), "EncryptedDetailsShared"), "Patched"),
    "Paid",
  );

  assert.throws(() => applyClaimAction(paid, "PublicNoteAdded"), /Paid claims are final/);
  assert.throws(() => applyClaimAction({ ...claim, proofStatus: "Invalid" }, "RewardLocked"), /verified proof/);
  assert.throws(() => applyClaimAction(claim, "Rejected"), /only be rejected after reward is locked/);

  const rejected = applyClaimAction(applyClaimAction(claim, "RewardLocked"), "Rejected");
  assert.throws(() => applyClaimAction(rejected, "Paid"), /Rejected claims cannot be paid/);
});
