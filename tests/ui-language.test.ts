import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { glossary, roleDisplayLabels } from "../lib/i18n/glossary.ts";
import { en } from "../lib/i18n/en.ts";
import { getChineseProtocolValue, zh } from "../lib/i18n/zh.ts";
import { createInitialDemoState } from "../lib/store.ts";

test("Chinese UI copy uses Chinese for product labels and security terminology", () => {
  assert.equal(zh.navigation.home, "首页");
  assert.equal(zh.navigation.submitProof, "提交 ZK 证明");
  assert.equal(zh.navigation.createBounty, "发布赏金");
  assert.equal(zh.navigation.triage, "漏洞评审");
  assert.equal(zh.navigation.publicClaims, "公开存证榜");
  assert.equal(zh.home.title, "证明漏洞，不泄露利用细节。");
  assert.equal(en.home.title, "PROVE THE BUG. KEEP THE EXPLOIT PRIVATE.");
  assert.equal(zh.submit.title, "提交隐私证明");
  assert.equal(glossary.witnessCommitment, "见证承诺");
  assert.equal(glossary.nullifier, "防重复标识");
});

test("role switcher and status labels use Chinese by default", () => {
  assert.equal(roleDisplayLabels.ProjectOwner, "项目方");
  assert.equal(roleDisplayLabels.Whitehat, "白帽研究员");
  assert.equal(zh.status.proof.Verified, "已验证");
  assert.equal(zh.status.disclosure.EncryptedDetailsShared, "已记录外部加密分享");
  assert.equal(zh.status.payout.RewardLocked, "奖励已锁定（演示）");
  assert.equal(zh.status.severity.Critical, "严重");
});

test("primary pages consume the locale provider and keep Chinese as the default copy", () => {
  const navigation = readFileSync("components/navigation.tsx", "utf8");
  const dashboard = readFileSync("components/dashboard.tsx", "utf8");
  const createPage = readFileSync("app/create-bounty/page.tsx", "utf8");
  const submitPage = readFileSync("app/submit-proof/page.tsx", "utf8");
  const triagePage = readFileSync("app/triage/page.tsx", "utf8");
  const publicPage = readFileSync("app/public-claims/page.tsx", "utf8");

  for (const source of [navigation, dashboard, createPage, submitPage, triagePage, publicPage]) {
    assert.match(source, /useLocale|copy\./);
  }
  assert.equal(zh.common.skipToContent, "跳到主要内容");
  assert.equal(en.common.skipToContent, "Skip to main content");
  assert.equal(en.submit.title, "Submit a Private Proof");
  assert.equal(en.publicClaims.title, "Public Claims");
});

test("language switcher uses a shareable URL and never persists a locale", () => {
  const provider = readFileSync("components/locale-provider.tsx", "utf8");
  const switcher = readFileSync("components/language-switcher.tsx", "utf8");

  assert.match(provider, /useState<Locale>\("zh"\)/);
  assert.match(switcher, /params\.set\("lang", "en"\)/);
  assert.equal(`${provider}\n${switcher}`.includes("localStorage"), false);
  assert.equal(`${provider}\n${switcher}`.includes("sessionStorage"), false);
});

test("UI localization does not change public metadata field structure", () => {
  const entry = createInitialDemoState().publicClaimRegistry[0];
  for (const field of ["claimHash", "receiptId", "registryKey", "witnessCommitment", "nullifier", "proofEngine"]) {
    assert.equal(Object.hasOwn(entry, field), true, `${field} must remain unchanged`);
  }
});

test("AI recommendation and initial triage timeline use Chinese primary copy", () => {
  const state = createInitialDemoState();
  assert.equal(
    getChineseProtocolValue(state.triageActions[0].publicNote),
    "已生成经过验证的漏洞声明收据，可供项目方审查公开元数据。",
  );
  const copilotSource = readFileSync("lib/ai-triage-copilot.ts", "utf8");
  assert.match(copilotSource, /本建议仅基于公开元数据/);
  assert.match(copilotSource, /为已验证的漏洞声明锁定奖励/);
  assert.match(copilotSource, /This recommendation is based only on public metadata/);
});

test("Chinese mode localizes workflow labels and dynamic protocol metadata", () => {
  const submitPage = readFileSync("app/submit-proof/page.tsx", "utf8");
  const createForm = readFileSync("components/aleo-create-bounty-form.tsx", "utf8");
  const triageWorkspace = readFileSync("components/on-chain-triage-workspace.tsx", "utf8");
  const disclosure = readFileSync("components/encrypted-disclosure-workbench.tsx", "utf8");

  assert.match(submitPage, /赏金编号必须是公开 Aleo field 字面量/);
  assert.match(submitPage, /模拟不变量引擎/);
  assert.match(createForm, /严重级奖励（microcredits）/);
  assert.match(triageWorkspace, /托管可用余额/);
  assert.match(disclosure, /加密披露 · 仅限当前设备/);

  assert.equal(getChineseProtocolValue("Demo Vault"), "演示金库");
  assert.equal(getChineseProtocolValue("Mock Invariant Engine"), "模拟不变量引擎");
  assert.equal(getChineseProtocolValue("Vault accounting invariant breach"), "金库记账不变量被破坏");
  assert.equal(getChineseProtocolValue("testnet"), "Aleo 测试网");
});
