import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("create bounty page lets project owners select a DemoVault rule", () => {
  const source = readFileSync("components/bounty-form.tsx", "utf8");

  assert.equal(source.includes("DEMO_VAULT_RULES"), true);
  assert.equal(source.includes("Rule"), true);
  assert.equal(source.includes("ruleId"), true);
});

test("submit proof page includes private state inputs for each DemoVault invariant", () => {
  const source = readFileSync("app/submit-proof/page.tsx", "utf8");

  for (const label of [
    "totalDeposits",
    "reservedRewards",
    "withdrawLimit",
    "userBalance",
    "requestedWithdrawAmount",
    "hiddenDeltaReservedRewards",
    "hiddenDeltaWithdrawAmount",
    "hiddenDeltaUserBalance",
  ]) {
    assert.equal(source.includes(label), true, `${label} field should be present`);
  }
});

test("dashboard explains the protocol layer from private witness to public registry", () => {
  const source = readFileSync("components/dashboard.tsx", "utf8");

  for (const phrase of [
    "协议说明",
    "Private Witness",
    "Commitment",
    "Nullifier",
    "Claim Receipt",
    "Aleo Testnet Program Mappings",
    "Confirmed 与 Mapping Verified 分开表达",
    "不进入 Store、URL、日志或 Public Metadata",
  ]) {
    assert.equal(source.includes(phrase), true, `${phrase} should be present on dashboard`);
  }
});

test("dashboard presents the Multi-Invariant DemoVault rules", () => {
  const source = readFileSync("components/dashboard.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${uiCopySource}`;

  for (const phrase of [
    "Multi-Invariant DemoVault",
    "Vault Accounting Safety",
    "Claims vs Deposits Safety",
    "Reward Reserve Safety",
    "Withdrawal Limit Safety",
    "安全规则",
    "AleoRegistryOverview",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present on dashboard`);
  }
});
