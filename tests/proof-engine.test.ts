import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  createAleoProgramEngine,
  createAleoPlaceholderEngine,
  createMockVaultEngine,
} from "../lib/proof-engines/index.ts";
import { DEMO_VAULT_RULES } from "../lib/demo-vault.ts";
import { createInitialDemoState } from "../lib/store.ts";
import type { Bounty } from "../lib/models.ts";

const validInput = {
  vaultBalance: 100,
  totalClaims: 80,
  hiddenDeltaBalance: 90,
  hiddenDeltaClaims: 30,
  privateCallSequence: "local simulated call sequence",
  privateStateValues: "local simulated state values",
  reporterSecret: "whitehat-secret-1",
};

function bountyForRule(ruleId: Bounty["ruleId"]): Bounty {
  const state = createInitialDemoState();
  const rule = DEMO_VAULT_RULES.find((item) => item.id === ruleId);
  assert.ok(rule);
  return {
    ...state.bounties[0],
    ruleId,
    ruleName: rule.name,
    ruleText: rule.invariantText,
    affectedModule: rule.affectedModule,
    scope: rule.affectedModule,
  };
}

const witnessByRule = {
  "vault-accounting-safety": {
    vaultBalance: 100,
    totalClaims: 80,
    hiddenDeltaBalance: 90,
    hiddenDeltaClaims: 30,
  },
  "claims-vs-deposits": {
    totalDeposits: 100,
    totalClaims: 80,
    hiddenDeltaClaims: 30,
  },
  "reward-reserve-safety": {
    vaultBalance: 100,
    reservedRewards: 20,
    hiddenDeltaBalance: 40,
    hiddenDeltaReservedRewards: 90,
  },
  "withdraw-limit-safety": {
    withdrawLimit: 50,
    userBalance: 40,
    requestedWithdrawAmount: 20,
    hiddenDeltaWithdrawAmount: 35,
    hiddenDeltaUserBalance: 10,
  },
} as const;

test("valid private witness generates verified public proof and receipt", async () => {
  const proof = await createMockVaultEngine().generateProof(
    { ...validInput, reporterSecret: "whitehat-secret-1" },
    bountyForRule("vault-accounting-safety"),
  );

  assert.equal(proof.proofEngine, "Mock Invariant Engine");
  assert.equal(proof.verified, true);
  assert.equal(proof.proofStatus, "Verified");
  assert.equal(proof.severity, "Critical");
  assert.equal(proof.bugType, "Vault Invariant Break");
  assert.equal(proof.ruleId, "vault-accounting-safety");
  assert.equal(proof.ruleName, "Vault Accounting Safety");
  assert.equal(proof.affectedModule, "Vault accounting logic");
  assert.equal(proof.impact, 100);
  assert.match(proof.claimHash, /^0x[0-9a-f]{16}$/);
  assert.match(proof.witnessCommitment, /^0x[0-9a-f]{16}$/);
  assert.match(proof.nullifier, /^0x[0-9a-f]{16}$/);
  assert.match(proof.reporterCommitment, /^0x[0-9a-f]{16}$/);
  assert.match(proof.receiptId, /^0x[0-9a-f]{16}$/);
  assert.match(proof.registryKey, /^0x[0-9a-f]{16}$/);
});

test("invalid witness and invalid initial state do not verify", async () => {
  const engine = createMockVaultEngine();
  const bounty = bountyForRule("vault-accounting-safety");

  const intact = await engine.generateProof(
    { ...validInput, hiddenDeltaBalance: 5, hiddenDeltaClaims: 5 },
    bounty,
  );
  assert.equal(intact.verified, false);
  assert.equal(intact.proofStatus, "Invalid");

  const invalidInitial = await engine.generateProof(
    { ...validInput, vaultBalance: 70, totalClaims: 80 },
    bounty,
  );
  assert.equal(invalidInitial.verified, false);
  assert.equal(invalidInitial.reason, "Initial state is invalid");
});

test("duplicate nullifier cannot generate a second verified claim", async () => {
  const state = createInitialDemoState();
  const existing = new Set(state.claims.map((claim) => claim.nullifier));
  const proof = await createMockVaultEngine(existing).generateProof(
    { ...validInput, reporterSecret: "whitehat-secret-1" },
    bountyForRule("vault-accounting-safety"),
  );

  assert.equal(proof.verified, false);
  assert.equal(proof.reason, "Duplicate claim detected. This nullifier has already been used.");
});

test("proof result excludes private fields and calculates severity by impact", async () => {
  const bounty = bountyForRule("vault-accounting-safety");
  const engine = createMockVaultEngine();
  const medium = await engine.generateProof(
    { ...validInput, hiddenDeltaBalance: 25, hiddenDeltaClaims: 5, reporterSecret: "medium-secret" },
    bounty,
  );
  const low = await engine.generateProof(
    { ...validInput, hiddenDeltaBalance: 1, hiddenDeltaClaims: 1, reporterSecret: "low-secret" },
    bounty,
  );

  assert.equal(medium.severity, "Medium");
  assert.equal(medium.verified, true);
  assert.equal(low.severity, "Low");
  assert.equal(low.verified, false);

  const serialized = JSON.stringify(medium);
  for (const forbidden of [
    "vaultBalanceBefore",
    "totalClaimsBefore",
    "hiddenDeltaReservedRewards",
    "hiddenDeltaWithdrawAmount",
    "hiddenDeltaUserBalance",
    "hiddenDeltaBalance",
    "hiddenDeltaClaims",
    "privateCallSequence",
    "privateStateValues",
    "reporterSecret",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} must not leave proof engine`);
  }
  assert.deepEqual(Object.keys(medium).sort(), [
    "bugType",
    "claimHash",
    "claimReceiptId",
    "affectedModule",
    "impact",
    "nullifier",
    "proofEngine",
    "proofStatus",
    "protocolVersion",
    "receiptId",
    "registryKey",
    "reporterCommitment",
    "ruleId",
    "ruleName",
    "scopeHash",
      "severity",
      "verification",
      "verified",
    "witnessCommitment",
  ].sort());
});

test("MockVaultEngine supports all 4 DemoVault rules", async () => {
  for (const rule of DEMO_VAULT_RULES) {
    const proof = await createMockVaultEngine().generateProof(
      {
        ...witnessByRule[rule.id],
        reporterSecret: `secret-${rule.id}`,
      },
      bountyForRule(rule.id),
    );

    assert.equal(proof.verified, true, `${rule.id} should verify`);
    assert.equal(proof.ruleId, rule.id);
    assert.equal(proof.ruleName, rule.name);
    assert.equal(proof.affectedModule, rule.affectedModule);
    assert.equal(proof.impact >= 10, true);
  }
});

test("Aleo rule returns safe unavailable result when no prover exists", async () => {
  const proof = await createAleoProgramEngine().generateProof(
    {
      ...witnessByRule["claims-vs-deposits"],
      reporterSecret: "aleo-unsupported-rule-secret",
    },
    bountyForRule("claims-vs-deposits"),
  );

  assert.equal(proof.verified, false);
  assert.equal(proof.proofStatus, "Invalid");
  assert.equal(proof.verification?.level, "Unavailable");
  assert.match(proof.reason ?? "", /local Leo CLI/);
});

test("aleo placeholder engine never verifies or connects to a real chain", async () => {
  const state = createInitialDemoState();
  const proof = await createAleoPlaceholderEngine().generateProof(validInput, state.bounties[0]);

  assert.equal(proof.proofEngine, "Aleo Leo Proof Placeholder");
  assert.equal(proof.verified, false);
  assert.equal(proof.proofStatus, "Invalid");
  assert.match(proof.reason ?? "", /placeholder/i);
});

test("submit proof page defaults to mock invariant engine selector", () => {
  const source = readFileSync("app/submit-proof/page.tsx", "utf8");

  assert.equal(source.includes('value="Mock Invariant Engine"'), true);
  assert.equal(source.includes("Mock Invariant Engine"), true);
  assert.equal(source.includes("Wallet-signed submit_claim"), true);
  assert.equal(source.includes("/api/aleo/prove"), false);
});
