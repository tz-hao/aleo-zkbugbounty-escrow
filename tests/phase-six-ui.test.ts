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

test("dashboard keeps the privacy promise and one primary protocol entry", () => {
  const source = readFileSync("components/dashboard.tsx", "utf8");
  const heroSource = readFileSync("components/hero-proof-visual.tsx", "utf8");
  const combinedSource = `${source}\n${heroSource}`;

  for (const phrase of [
    "Private by default",
    "证明漏洞存在",
    "Exploit 无需公开",
    "zh.brand.slogan",
    "href=\"/submit-proof\"",
    "Private Witness 留在设备端",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present on dashboard`);
  }
});

test("Multi-Invariant DemoVault rules remain in the create and submit workflows", () => {
  const createSource = readFileSync("components/bounty-form.tsx", "utf8");
  const submitSource = readFileSync("app/submit-proof/page.tsx", "utf8");
  const vaultSource = readFileSync("lib/demo-vault.ts", "utf8");
  const combinedSource = `${createSource}\n${submitSource}\n${vaultSource}`;

  for (const phrase of [
    "DEMO_VAULT_RULES",
    "vault-accounting-safety",
    "claims-vs-deposits",
    "reward-reserve-safety",
    "withdraw-limit-safety",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should remain in workflow code`);
  }
});
