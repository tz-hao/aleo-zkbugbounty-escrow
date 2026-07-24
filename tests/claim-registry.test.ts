import assert from "node:assert/strict";
import { test } from "node:test";

import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import {
  createEmptyClaimRegistry,
  getClaimByRegistryKey,
  getNullifierRecord,
  getReceiptById,
  isNullifierUsed,
  listClaimsByBounty,
  listPublicClaims,
  registerVerifiedClaim,
} from "../lib/protocol/claim-registry.ts";
import { createMockVaultEngine } from "../lib/proof-engines/index.ts";
import { createInitialDemoState } from "../lib/store.ts";
import type { ProofResult } from "../lib/models.ts";

async function verifiedProof(): Promise<ProofResult> {
  const state = createInitialDemoState();
  return createMockVaultEngine().generateProof(
    {
      vaultBalance: 100,
      totalClaims: 80,
      hiddenDeltaBalance: 90,
      hiddenDeltaClaims: 30,
      privateCallSequence: "registry private sequence",
      privateStateValues: "registry private state",
      reporterSecret: "registry-secret",
      bugType: "Vault Invariant Break",
    },
    state.bounties[0],
  );
}

test("verified claim registers receipt, nullifier, and public registry entry", async () => {
  const state = createInitialDemoState();
  const bounty = state.bounties[0];
  const proof = await verifiedProof();
  const result = registerVerifiedClaim(createEmptyClaimRegistry(), {
    claimId: "claim-registry-001",
    bounty,
    proof,
    createdAt: "2026-07-06T08:00:00.000Z",
  });

  assert.equal(isNullifierUsed(result.registry, proof.nullifier), true);
  assert.equal(getNullifierRecord(result.registry, proof.nullifier)?.claimId, "claim-registry-001");
  assert.equal(getReceiptById(result.registry, proof.receiptId)?.receiptId, proof.receiptId);
  assert.equal(getClaimByRegistryKey(result.registry, proof.registryKey)?.claimHash, proof.claimHash);
  assert.equal(result.entry.ruleName, proof.ruleName);
  assert.equal(result.entry.affectedModule, proof.affectedModule);
  assert.equal(result.entry.impact, proof.impact);
  assert.equal(result.receipt.ruleName, proof.ruleName);
  assert.equal(result.receipt.affectedModule, proof.affectedModule);
  assert.equal(result.receipt.impact, proof.impact);
  assert.equal(listPublicClaims(result.registry).length, 1);
  assert.equal(listClaimsByBounty(result.registry, bounty.id).length, 1);
  assertNoPrivateFields(result.entry);
  assertNoPrivateFields(result.receipt);
  assertNoPrivateFields(result.nullifierRecord);
});

test("claim registry rejects invalid proof results", () => {
  const state = createInitialDemoState();
  const proof: ProofResult = {
    verified: false,
    claimHash: "0xinvalidclaim",
    witnessCommitment: "0xinvalidwitnesscommitment",
    nullifier: "0xinvalidnullifier",
    reporterCommitment: "0xinvalidreportercommitment",
    receiptId: "",
    registryKey: "",
    bugType: "Vault Invariant Break",
    severity: "Low",
    proofStatus: "Invalid",
    scopeHash: state.bounties[0].scopeHash,
    ruleId: state.bounties[0].ruleId,
    ruleName: state.bounties[0].ruleName,
    affectedModule: state.bounties[0].affectedModule,
    impact: 0,
    proofEngine: "Mock Invariant Engine",
    protocolVersion: {
      version: "zkbb-protocol-v1",
      proofSystem: "mock-invariant",
      commitmentScheme: "fnv1a-demo",
      nullifierScheme: "bounty-rule-reporter-demo",
    },
  };

  assert.throws(
    () =>
      registerVerifiedClaim(createEmptyClaimRegistry(), {
        claimId: "claim-invalid",
        bounty: state.bounties[0],
        proof,
        createdAt: "2026-07-06T08:00:00.000Z",
      }),
    /Only verified proofs can be registered/,
  );
});

test("claim registry rejects duplicate nullifier without writing extra records", async () => {
  const state = createInitialDemoState();
  const proof = await verifiedProof();
  const first = registerVerifiedClaim(createEmptyClaimRegistry(), {
    claimId: "claim-registry-001",
    bounty: state.bounties[0],
    proof,
    createdAt: "2026-07-06T08:00:00.000Z",
  });

  assert.throws(
    () =>
      registerVerifiedClaim(first.registry, {
        claimId: "claim-registry-002",
        bounty: state.bounties[0],
        proof,
        createdAt: "2026-07-06T08:01:00.000Z",
      }),
    /Duplicate claim detected\. This nullifier has already been used\./,
  );
  assert.equal(first.registry.publicClaimRegistry.length, 1);
  assert.equal(first.registry.claimReceipts.length, 1);
  assert.equal(first.registry.nullifierRecords.length, 1);
});
