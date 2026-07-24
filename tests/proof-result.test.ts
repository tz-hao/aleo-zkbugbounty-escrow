import assert from "node:assert/strict";
import { test } from "node:test";

import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import { createAleoProgramEngine, createMockVaultEngine } from "../lib/proof-engines/index.ts";
import { createInitialDemoState } from "../lib/store.ts";
import type { LeoCliDetection, LeoCommandRunner } from "../lib/leo-cli.ts";
import type { PrivateProofInput } from "../lib/proof-engines/types.ts";
import type { ProofResult } from "../lib/models.ts";

const input: PrivateProofInput = {
  vaultBalance: 100,
  totalClaims: 80,
  hiddenDeltaBalance: 90,
  hiddenDeltaClaims: 30,
  privateCallSequence: "proof-result private sequence",
  privateStateValues: "proof-result private state",
  reporterSecret: "proof-result-secret",
  bugType: "Vault Invariant Break",
};

const wslLeo: LeoCliDetection = {
  available: true,
  mode: "wsl",
  version: "leo 4.0.2",
  command: "wsl bash -lc",
};

const validLeoOutput = `
➡️  Output
• {
  verified: true,
  severity: 3u8,
  claim_hash: 15007field,
  witness_commitment: 9018field,
  nullifier: 10002field,
  reporter_commitment: 7007field,
  bug_type_id: 1field,
  rule_id: 1field
}
`;

function assertCompleteProofResult(proof: ProofResult) {
  for (const key of [
    "verified",
    "claimHash",
    "witnessCommitment",
    "nullifier",
    "reporterCommitment",
    "receiptId",
    "registryKey",
    "bugType",
    "severity",
    "proofStatus",
    "scopeHash",
    "ruleId",
    "ruleName",
    "affectedModule",
    "impact",
    "proofEngine",
    "protocolVersion",
  ] as const) {
    assert.notEqual(proof[key], undefined, `${key} must exist on ProofResult`);
  }
  if (proof.proofEngine === "Aleo Leo Proof") {
    assert.match(proof.claimHash, /^[0-9]+field$/);
    assert.match(proof.witnessCommitment, /^[0-9]+field$/);
    assert.match(proof.nullifier, /^[0-9]+field$/);
    assert.match(proof.reporterCommitment, /^[0-9]+field$/);
    assert.match(proof.receiptId, /^leo-local:/);
    assert.match(proof.registryKey, /^leo-local:/);
    assert.equal(proof.protocolVersion.version, "zkbb-aleo-v2");
  } else {
    assert.match(proof.claimHash, /^0x[0-9a-f]{16}$/);
    assert.match(proof.witnessCommitment, /^0x[0-9a-f]{16}$/);
    assert.match(proof.nullifier, /^0x[0-9a-f]{16}$/);
    assert.match(proof.reporterCommitment, /^0x[0-9a-f]{16}$/);
    assert.match(proof.receiptId, /^0x[0-9a-f]{16}$/);
    assert.match(proof.registryKey, /^0x[0-9a-f]{16}$/);
    assert.equal(proof.protocolVersion.version, "zkbb-protocol-v1");
  }
  assert.equal(proof.impact >= 0, true);
  assert.equal(proof.ruleName.length > 0, true);
  assert.equal(proof.affectedModule.length > 0, true);
  assertNoPrivateFields(proof);
}

test("MockVaultEngine outputs complete protocol-like ProofResult", async () => {
  const state = createInitialDemoState();
  const proof = await createMockVaultEngine().generateProof(input, state.bounties[0]);

  assert.equal(proof.verified, true);
  assert.equal(proof.proofStatus, "Verified");
  assert.equal(proof.severity, "Critical");
  assertCompleteProofResult(proof);
});

test("AleoProgramEngine output aligns with Mock proof result fields and semantics", async () => {
  const state = createInitialDemoState();
  const runner: LeoCommandRunner = async () => ({
    exitCode: 0,
    stdout: validLeoOutput,
    stderr: "",
  });
  const mock = await createMockVaultEngine().generateProof(input, state.bounties[0]);
  const aleo = await createAleoProgramEngine(new Set(), {
    detection: wslLeo,
    runner,
  }).generateProof(input, state.bounties[0]);

  assert.equal(aleo.verified, mock.verified);
  assert.equal(aleo.proofStatus, mock.proofStatus);
  assert.equal(aleo.severity, mock.severity);
  assert.equal(aleo.bugType, "Vault Accounting Invariant Break");
  assert.equal(aleo.scopeHash, mock.scopeHash);
  assert.equal(aleo.ruleId, mock.ruleId);
  assertCompleteProofResult(aleo);
});
