import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createClaimHash,
  createNullifier,
  createReceiptId,
  createRegistryKey,
  createReporterCommitment,
  createWitnessCommitment,
} from "../lib/protocol/crypto.ts";

const publicInput = {
  bountyId: "bounty-001",
  ruleId: "vault-balance-gte-total-claims",
  scopeHash: "0xscope",
  bugType: "Vault Invariant Break",
  severity: "Critical",
  timestamp: "2026-07-06T08:00:00.000Z",
};

test("protocol hash helpers create deterministic 0x identifiers", () => {
  const witnessCommitment = createWitnessCommitment({
    ruleId: publicInput.ruleId,
    scopeHash: publicInput.scopeHash,
    witnessSummary: "local private witness summary",
  });
  const nullifier = createNullifier({
    bountyId: publicInput.bountyId,
    ruleId: publicInput.ruleId,
    reporterSecret: "whitehat-secret",
  });
  const claimHash = createClaimHash({
    ...publicInput,
    witnessCommitment,
    nullifier,
  });
  const receiptId = createReceiptId({
    claimHash,
    bountyId: publicInput.bountyId,
    proofEngine: "Mock Invariant Engine",
    verifiedAt: publicInput.timestamp,
  });
  const registryKey = createRegistryKey({
    bountyId: publicInput.bountyId,
    claimHash,
  });

  for (const value of [witnessCommitment, nullifier, claimHash, receiptId, registryKey]) {
    assert.match(value, /^0x[0-9a-f]{16}$/);
  }
  assert.equal(
    createClaimHash({
      ...publicInput,
      witnessCommitment,
      nullifier,
    }),
    claimHash,
  );
  assert.equal(
    createReceiptId({
      claimHash,
      bountyId: publicInput.bountyId,
      proofEngine: "Mock Invariant Engine",
      verifiedAt: publicInput.timestamp,
    }),
    receiptId,
  );
});

test("reporter commitments and nullifiers never expose reporter secret directly", () => {
  const reporterSecret = "same-secret";
  const reporterCommitment = createReporterCommitment({ reporterSecret });
  const nullifier = createNullifier({
    bountyId: publicInput.bountyId,
    ruleId: publicInput.ruleId,
    reporterSecret,
  });

  assert.notEqual(reporterCommitment, reporterSecret);
  assert.notEqual(nullifier, reporterSecret);
  assert.equal(reporterCommitment.includes(reporterSecret), false);
  assert.equal(nullifier.includes(reporterSecret), false);
});

test("nullifier semantics depend on reporter secret, bounty, and rule", () => {
  const first = createNullifier({
    bountyId: publicInput.bountyId,
    ruleId: publicInput.ruleId,
    reporterSecret: "secret-a",
  });
  const second = createNullifier({
    bountyId: publicInput.bountyId,
    ruleId: publicInput.ruleId,
    reporterSecret: "secret-b",
  });
  const repeat = createNullifier({
    bountyId: publicInput.bountyId,
    ruleId: publicInput.ruleId,
    reporterSecret: "secret-a",
  });

  assert.notEqual(first, second);
  assert.equal(first, repeat);
});
