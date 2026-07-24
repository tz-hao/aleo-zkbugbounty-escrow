import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateSeverity, evaluateDemoVaultInvariant } from "../lib/demo-vault.ts";
import type { DemoVaultRuleId } from "../lib/models.ts";

const baseState = {
  vaultBalance: 100,
  totalDeposits: 100,
  totalClaims: 80,
  reservedRewards: 20,
  withdrawLimit: 50,
  userBalance: 50,
  requestedWithdrawAmount: 20,
};

const vectors: Record<
  DemoVaultRuleId,
  Array<{
    name: "valid" | "invalid" | "low-impact" | "boundary";
    state?: Partial<typeof baseState>;
    witness: Record<string, number | string>;
    broken: boolean;
    impact: number;
  }>
> = {
  "vault-accounting-safety": [
    { name: "valid", witness: { hiddenDeltaBalance: 90, hiddenDeltaClaims: 30, reporterSecret: "v1" }, broken: true, impact: 100 },
    { name: "invalid", witness: { reporterSecret: "v2" }, broken: false, impact: 0 },
    { name: "low-impact", state: { totalClaims: 95 }, witness: { hiddenDeltaBalance: 5, hiddenDeltaClaims: 5, reporterSecret: "v3" }, broken: true, impact: 5 },
    { name: "boundary", state: { totalClaims: 90 }, witness: { hiddenDeltaBalance: 10, hiddenDeltaClaims: 10, reporterSecret: "v4" }, broken: true, impact: 10 },
  ],
  "claims-vs-deposits": [
    { name: "valid", witness: { hiddenDeltaClaims: 120, reporterSecret: "c1" }, broken: true, impact: 100 },
    { name: "invalid", witness: { hiddenDeltaClaims: 5, reporterSecret: "c2" }, broken: false, impact: 0 },
    { name: "low-impact", state: { totalClaims: 95 }, witness: { hiddenDeltaClaims: 10, reporterSecret: "c3" }, broken: true, impact: 5 },
    { name: "boundary", state: { totalClaims: 90 }, witness: { hiddenDeltaClaims: 20, reporterSecret: "c4" }, broken: true, impact: 10 },
  ],
  "reward-reserve-safety": [
    { name: "valid", witness: { hiddenDeltaReservedRewards: 180, reporterSecret: "r1" }, broken: true, impact: 100 },
    { name: "invalid", witness: { hiddenDeltaReservedRewards: 10, reporterSecret: "r2" }, broken: false, impact: 0 },
    { name: "low-impact", state: { reservedRewards: 95 }, witness: { hiddenDeltaReservedRewards: 10, reporterSecret: "r3" }, broken: true, impact: 5 },
    { name: "boundary", state: { reservedRewards: 90 }, witness: { hiddenDeltaReservedRewards: 20, reporterSecret: "r4" }, broken: true, impact: 10 },
  ],
  "withdraw-limit-safety": [
    { name: "valid", witness: { hiddenDeltaWithdrawAmount: 130, reporterSecret: "w1" }, broken: true, impact: 100 },
    { name: "invalid", witness: { hiddenDeltaWithdrawAmount: 5, reporterSecret: "w2" }, broken: false, impact: 0 },
    { name: "low-impact", state: { requestedWithdrawAmount: 45 }, witness: { hiddenDeltaWithdrawAmount: 10, reporterSecret: "w3" }, broken: true, impact: 5 },
    { name: "boundary", state: { requestedWithdrawAmount: 40 }, witness: { hiddenDeltaWithdrawAmount: 20, reporterSecret: "w4" }, broken: true, impact: 10 },
  ],
};

test("canonical Leo source contains all four rule constraints", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");
  for (const field of ["1field", "2field", "3field", "4field"]) {
    assert.match(source, new RegExp(`rule_id == ${field}`));
  }
  for (const constraint of [
    "vault_balance_after < total_claims_after",
    "total_claims_after > total_deposits_after",
    "reserved_rewards_after > vault_balance_after",
    "requested_withdraw_after > withdraw_limit_after",
    "requested_withdraw_after > user_balance_after",
  ]) {
    assert.equal(source.includes(constraint), true, `${constraint} missing from Leo source`);
  }
});

for (const [ruleId, cases] of Object.entries(vectors) as Array<
  [DemoVaultRuleId, (typeof vectors)[DemoVaultRuleId]]
>) {
  test(`${ruleId} has valid, invalid, low-impact, and Medium boundary vectors`, () => {
    assert.deepEqual(cases.map((item) => item.name), ["valid", "invalid", "low-impact", "boundary"]);
    for (const vector of cases) {
      const result = evaluateDemoVaultInvariant(
        ruleId,
        { ...baseState, ...vector.state },
        vector.witness,
      );
      assert.equal(result.initialStateValid, true, `${vector.name} initial state`);
      assert.equal(result.invariantBroken, vector.broken, `${vector.name} broken state`);
      assert.equal(result.impact, vector.impact, `${vector.name} impact`);
      if (vector.name === "low-impact") assert.equal(calculateSeverity(result.impact), "Low");
      if (vector.name === "boundary") assert.equal(calculateSeverity(result.impact), "Medium");
    }
  });
}
