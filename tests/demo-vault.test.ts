import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateSeverity,
  DEMO_VAULT_RULES,
  evaluateDemoVaultInvariant,
} from "../lib/demo-vault.ts";

const validState = {
  vaultBalance: 100,
  totalDeposits: 100,
  totalClaims: 80,
  reservedRewards: 20,
  withdrawLimit: 50,
  userBalance: 40,
  requestedWithdrawAmount: 20,
};

test("DemoVault exposes the four named safety invariants", () => {
  assert.deepEqual(DEMO_VAULT_RULES.map((rule) => rule.id), [
    "vault-accounting-safety",
    "claims-vs-deposits",
    "reward-reserve-safety",
    "withdraw-limit-safety",
  ]);
  assert.deepEqual(DEMO_VAULT_RULES.map((rule) => rule.name), [
    "Vault Accounting Safety",
    "Claims vs Deposits Safety",
    "Reward Reserve Safety",
    "Withdrawal Limit Safety",
  ]);
});

test("vault-accounting-safety valid witness breaks invariant", () => {
  const result = evaluateDemoVaultInvariant("vault-accounting-safety", validState, {
    hiddenDeltaBalance: 90,
    hiddenDeltaClaims: 30,
    reporterSecret: "secret",
  });

  assert.equal(result.initialStateValid, true);
  assert.equal(result.invariantBroken, true);
  assert.equal(result.impact, 100);
});

test("vault-accounting-safety invalid witness does not break invariant", () => {
  const result = evaluateDemoVaultInvariant("vault-accounting-safety", validState, {
    hiddenDeltaBalance: 5,
    hiddenDeltaClaims: 5,
    reporterSecret: "secret",
  });

  assert.equal(result.initialStateValid, true);
  assert.equal(result.invariantBroken, false);
  assert.equal(result.impact, 0);
});

test("claims-vs-deposits valid witness breaks invariant", () => {
  const result = evaluateDemoVaultInvariant("claims-vs-deposits", validState, {
    hiddenDeltaClaims: 30,
    reporterSecret: "secret",
  });

  assert.equal(result.initialStateValid, true);
  assert.equal(result.invariantBroken, true);
  assert.equal(result.impact, 10);
});

test("reward-reserve-safety valid witness breaks invariant", () => {
  const result = evaluateDemoVaultInvariant("reward-reserve-safety", validState, {
    hiddenDeltaBalance: 40,
    hiddenDeltaReservedRewards: 90,
    reporterSecret: "secret",
  });

  assert.equal(result.initialStateValid, true);
  assert.equal(result.invariantBroken, true);
  assert.equal(result.impact, 50);
});

test("withdraw-limit-safety valid witness breaks invariant", () => {
  const result = evaluateDemoVaultInvariant("withdraw-limit-safety", validState, {
    hiddenDeltaWithdrawAmount: 35,
    hiddenDeltaUserBalance: 10,
    reporterSecret: "secret",
  });

  assert.equal(result.initialStateValid, true);
  assert.equal(result.invariantBroken, true);
  assert.equal(result.impact, 25);
});

test("initial invalid state cannot verify", () => {
  const result = evaluateDemoVaultInvariant(
    "vault-accounting-safety",
    { ...validState, vaultBalance: 70 },
    {
      hiddenDeltaBalance: 90,
      hiddenDeltaClaims: 30,
      reporterSecret: "secret",
    },
  );

  assert.equal(result.initialStateValid, false);
  assert.equal(result.reason, "Initial state is invalid");
});

test("severity calculation works across thresholds", () => {
  assert.equal(calculateSeverity(100), "Critical");
  assert.equal(calculateSeverity(50), "High");
  assert.equal(calculateSeverity(10), "Medium");
  assert.equal(calculateSeverity(9), "Low");
  assert.equal(calculateSeverity(-1), "Low");
});
