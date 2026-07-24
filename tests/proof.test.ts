import assert from "node:assert/strict";
import { test } from "node:test";

import { generateMockProof } from "../lib/proof.ts";

test("verifies only when witness deltas break the vault invariant", () => {
  const proof = generateMockProof({
    bountyId: "bounty-001",
    bugType: "Vault accounting bypass",
    severity: "Critical",
    vaultBalanceBefore: 100,
    totalClaimsBefore: 80,
    hiddenDeltaBalance: 40,
    hiddenDeltaClaims: 30,
  });

  assert.equal(proof.verified, true);
  assert.equal(proof.severity, "Critical");
  assert.equal(proof.bugType, "Vault accounting bypass");
  assert.match(proof.claimHash, /^zkclaim_[a-f0-9]{16}$/);
});

test("does not verify when initial invariant is already broken", () => {
  assert.throws(
    () =>
      generateMockProof({
        bountyId: "bounty-001",
        bugType: "Vault accounting bypass",
        severity: "Critical",
        vaultBalanceBefore: 70,
        totalClaimsBefore: 80,
        hiddenDeltaBalance: 10,
        hiddenDeltaClaims: 20,
      }),
    /Initial vault invariant must hold/,
  );
});

test("does not verify when witness deltas keep the invariant intact", () => {
  const proof = generateMockProof({
    bountyId: "bounty-001",
    bugType: "Vault accounting bypass",
    severity: "High",
    vaultBalanceBefore: 100,
    totalClaimsBefore: 80,
    hiddenDeltaBalance: 5,
    hiddenDeltaClaims: 10,
  });

  assert.equal(proof.verified, false);
});

test("verified proof output never includes private witness values", () => {
  const proof = generateMockProof({
    bountyId: "bounty-001",
    bugType: "Vault accounting bypass",
    severity: "Critical",
    vaultBalanceBefore: 100,
    totalClaimsBefore: 80,
    hiddenDeltaBalance: 40,
    hiddenDeltaClaims: 30,
    triggeringParameters: "private calldata and exploit path",
  });

  assert.deepEqual(Object.keys(proof).sort(), [
    "bugType",
    "claimHash",
    "severity",
    "verified",
  ]);
  assert.equal(JSON.stringify(proof).includes("hiddenDeltaBalance"), false);
  assert.equal(JSON.stringify(proof).includes("hiddenDeltaClaims"), false);
  assert.equal(JSON.stringify(proof).includes("triggeringParameters"), false);
  assert.equal(JSON.stringify(proof).includes("private calldata"), false);
});
