import assert from "node:assert/strict";
import test from "node:test";

import {
  assessPublicReceiptForV3,
  resolveArbitrationVotes,
  transitionClaimV3,
  validateBountyV3Policy,
  type ArbitrationPanel,
} from "../lib/protocol-v3.ts";
import type { OnChainClaimReceipt } from "../lib/models.ts";

const PANEL: ArbitrationPanel = {
  panelId: "9field",
  members: ["aleo1alpha", "aleo1bravo", "aleo1charlie"],
  quorum: 2,
  reviewWindowBlocks: 720,
  decisionWindowBlocks: 1_440,
  arbitrationFeeMicrocredits: "1000000",
};

const RECEIPT: OnChainClaimReceipt = {
  claimHash: "11field",
  bountyId: "12field",
  ruleId: "vault-accounting-safety",
  scopeHash: "13field",
  severity: "Critical",
  witnessCommitment: "14field",
  nullifier: "15field",
  reporterCommitment: "16field",
  proofStatus: "Verified",
  createdHeight: 100,
  protocolVersion: 3,
  source: "AleoTestnet",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
  mapping: "claim_receipts",
};

test("V3 treats a public receipt as review and reward-lock eligibility, not final vulnerability confirmation", () => {
  const assessment = assessPublicReceiptForV3(RECEIPT);
  assert.equal(assessment.eligibleForOwnerReview, true);
  assert.equal(assessment.eligibleForRewardLock, true);
  assert.equal(assessment.recommendedSeverity, "Critical");
  assert.match(assessment.unresolvedFacts.join(" "), /real target-system vulnerability/);
  assert.match(assessment.unresolvedFacts.join(" "), /reproducible/);
});
test("V3 requires a public immutable 2-of-3 panel configuration", () => {
  assert.equal(validateBountyV3Policy({
    protocolVersion: 3,
    disclosureKeyCommitment: "10field",
    targetSystemCommitment: "17field",
    targetCodeHash: "18field",
    panel: PANEL,
    paymentCondition: "OnPatchAcceptance",
  }), true);
  assert.throws(() => validateBountyV3Policy({
    protocolVersion: 3,
    disclosureKeyCommitment: "10field",
    targetSystemCommitment: "17field",
    targetCodeHash: "18field",
    panel: { ...PANEL, members: ["aleo1alpha", "aleo1alpha", "aleo1charlie"] },
    paymentCondition: "OnPatchAcceptance",
  }), /distinct/);
  assert.throws(() => validateBountyV3Policy({
    protocolVersion: 3,
    disclosureKeyCommitment: "10field",
    targetSystemCommitment: "not-a-field",
    targetCodeHash: "18field",
    panel: PANEL,
    paymentCondition: "OnPatchAcceptance",
  }), /Target system and code/);
});

test("V3 keeps review, reward lock, encrypted delivery, reproduction, patch acceptance, and payment distinct", () => {
  const policy = "OnPatchAcceptance" as const;
  let state = transitionClaimV3("Submitted", "BeginReview", "ProjectOwner", policy);
  state = transitionClaimV3(state, "AcceptClaim", "ProjectOwner", policy);
  state = transitionClaimV3(state, "LockReward", "ProjectOwner", policy);
  state = transitionClaimV3(state, "DeliverDisclosure", "Whitehat", policy);
  state = transitionClaimV3(state, "AcknowledgeDisclosure", "ProjectOwner", policy);
  state = transitionClaimV3(state, "ConfirmReproduction", "ProjectOwner", policy);
  state = transitionClaimV3(state, "ProposePatch", "ProjectOwner", policy);
  state = transitionClaimV3(state, "AcceptPatch", "Whitehat", policy);
  state = transitionClaimV3(state, "ReleaseReward", "Public", policy);
  assert.equal(state, "Paid");
  assert.throws(() => transitionClaimV3("Submitted", "LockReward", "ProjectOwner", policy));
});

test("V3 arbitration can only uphold a receipt at or below its circuit-proven severity", () => {
  assert.deepEqual(resolveArbitrationVotes(["High", "High"], PANEL, "Critical").verdict, "High");
  assert.throws(() => resolveArbitrationVotes(["Critical", "Critical"], PANEL, "High"), /cannot raise/);
});

test("V3 gives both parties an actor-specific dispute path", () => {
  const policy = "OnPatchAcceptance" as const;
  assert.equal(
    transitionClaimV3("ReproductionRejected", "OpenDispute", "Whitehat", policy),
    "Disputed",
  );
  assert.equal(
    transitionClaimV3("RewardLocked", "EscalateTimeout", "ProjectOwner", policy),
    "Disputed",
  );
  assert.throws(
    () => transitionClaimV3("RewardLocked", "OpenDispute", "ProjectOwner", policy),
    /Whitehat/,
  );
  assert.throws(
    () => transitionClaimV3("Submitted", "EscalateTimeout", "PanelMember", policy),
    /waiting on the expired SLA/,
  );
});
