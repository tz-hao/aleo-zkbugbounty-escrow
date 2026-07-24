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
  const uiCopy = `${readFileSync("lib/i18n/zh.ts", "utf8")}\n${readFileSync("lib/i18n/glossary.ts", "utf8")}`;
  const combinedSource = `${source}\n${uiCopy}`;

  for (const phrase of [
    "公开协议层（Protocol Layer）",
    "Private Witness",
    "Witness Commitment",
    "Nullifier",
    "Claim Hash",
    "Claim Receipt",
    "Public Claim Registry",
    "Witness Commitment 证明 Whitehat 已提交私有见证数据",
    "Nullifier 用于阻止重复 Claim",
    "Claim Receipt 提供可审计的公开元数据；是否链上确认以 Verification Level 为准。",
    "Public Claim Registry 模拟 Aleo 的公开 Mapping。",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present on dashboard`);
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
    "Project Owner 可使用预设安全 Invariant 定义 Bounty Scope",
    "Whitehat 使用 Private Witness 证明规则被破坏",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present on dashboard`);
  }
});
