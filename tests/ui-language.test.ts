import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { glossary, roleDisplayLabels } from "../lib/i18n/glossary.ts";
import { zh } from "../lib/i18n/zh.ts";
import { createInitialDemoState } from "../lib/store.ts";

test("Chinese UI copy keeps required security terms in English", () => {
  assert.equal(zh.navigation.home, "首页");
  assert.match(zh.navigation.submitProof, /Private Proof/);
  assert.match(zh.home.title, /Exploit/);
  assert.match(zh.submit.title, /Submit Private Proof/);
  assert.equal(glossary.witnessCommitment, "见证承诺（Witness Commitment）");
  assert.equal(glossary.nullifier, "防重复标识（Nullifier）");
});

test("role switcher and status labels are bilingual or Chinese", () => {
  assert.equal(roleDisplayLabels.ProjectOwner, "项目方（Project Owner）");
  assert.equal(roleDisplayLabels.Whitehat, "白帽研究员（Whitehat）");
  assert.equal(zh.status.proof.Verified, "已验证");
  assert.equal(zh.status.disclosure.EncryptedDetailsShared, "外部加密分享状态已记录");
  assert.equal(zh.status.payout.RewardLocked, "奖励锁定状态（Demo）");
});

test("pages consume centralized Chinese UI copy", () => {
  const navigation = readFileSync("components/navigation.tsx", "utf8");
  const dashboard = readFileSync("components/dashboard.tsx", "utf8");
  const createPage = readFileSync("app/create-bounty/page.tsx", "utf8");
  const submitPage = readFileSync("app/submit-proof/page.tsx", "utf8");
  const triagePage = readFileSync("app/triage/page.tsx", "utf8");
  const publicPage = readFileSync("app/public-claims/page.tsx", "utf8");

  assert.match(navigation, /zh\.navigation/);
  assert.match(dashboard, /zh\.home/);
  assert.match(createPage, /zh\.createBounty/);
  assert.match(submitPage, /zh\.submit/);
  assert.match(triagePage, /zh\.triage/);
  assert.match(publicPage, /zh\.publicClaims/);
});

test("UI localization does not change public metadata field structure", () => {
  const entry = createInitialDemoState().publicClaimRegistry[0];
  for (const field of [
    "claimHash",
    "receiptId",
    "registryKey",
    "witnessCommitment",
    "nullifier",
    "proofEngine",
  ]) {
    assert.equal(Object.hasOwn(entry, field), true, `${field} must remain unchanged`);
  }
});

test("AI recommendation and initial triage timeline use Chinese primary copy", () => {
  const state = createInitialDemoState();
  assert.match(state.triageActions[0].publicNote, /可供 Project Owner/);

  const copilotSource = readFileSync("lib/ai-triage-copilot.ts", "utf8");
  assert.match(copilotSource, /本建议仅基于 Public Metadata/);
  assert.match(copilotSource, /锁定奖励（Lock Reward）/);
});
