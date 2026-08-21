import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Real Mode identity is derived from wallet and mapping, not Demo Preview", () => {
  const navigation = readFileSync("components/navigation.tsx", "utf8");
  const createForm = readFileSync("components/aleo-create-bounty-form.tsx", "utf8");
  const submitPage = readFileSync("app/submit-proof/page.tsx", "utf8");
  const transactionBuilder = readFileSync("lib/aleo-create-bounty.ts", "utf8");

  assert.equal(navigation.includes("useAppState"), false);
  assert.equal(navigation.includes("switchActor"), false);
  assert.equal(createForm.includes("canCreateBounty"), false);
  assert.equal(createForm.includes("currentActor"), false);
  assert.match(transactionBuilder, /ownerSource: "std::ctx::signer\(\)"/);

  const walletRequest = submitPage.slice(
    submitPage.indexOf("async function requestWalletSignedClaim"),
    submitPage.indexOf("function publishClaim"),
  );
  assert.equal(walletRequest.includes("demoAllowed"), false);
  assert.match(submitPage, /当前钱包将作为白帽研究员与报告人/);
});

test("Demo role selection is isolated in an explicitly local preview control", () => {
  const preview = readFileSync("components/demo-role-preview.tsx", "utf8");
  const createWorkspace = readFileSync("components/bounty-creation-workspace.tsx", "utf8");
  const triage = readFileSync("app/triage/page.tsx", "utf8");

  assert.match(preview, /Demo Preview Only/);
  assert.match(preview, /不代表钱包身份/);
  assert.match(createWorkspace, /mode === "real"/);
  assert.match(createWorkspace, /<DemoRolePreview/);
  assert.match(triage, /<DemoRolePreview/);
});

test("V2 compatibility is visually secondary to the current V3 workflow", () => {
  const createWorkspace = readFileSync("components/bounty-creation-workspace.tsx", "utf8");
  const submitPage = readFileSync("app/submit-proof/page.tsx", "utf8");

  for (const source of [createWorkspace, submitPage]) {
    assert.match(source, /<details className="rounded-lg border border-amber-300\/20/);
    assert.match(source, /历史兼容：已有 V2/);
    assert.match(source, /打开 V2 兼容/);
    assert.match(source, /grid-cols-2/);
  }
  assert.doesNotMatch(submitPage, /V2 历史兼容/);
});

test("homepage is a focused protocol entry without local or registry metrics", () => {
  const dashboard = readFileSync("components/dashboard.tsx", "utf8");
  const navigation = readFileSync("components/navigation.tsx", "utf8");

  assert.equal(dashboard.includes("useAppState"), false);
  assert.equal(dashboard.includes("AleoRegistryOverview"), false);
  assert.match(dashboard, /home-immersive/);
  assert.match(dashboard, /HeroProofVisual/);
  assert.match(dashboard, /href="\/submit-proof"/);
  assert.equal(dashboard.includes("home-immersive-mark"), false);
  assert.match(navigation, /pathname === "\/"/);
  assert.match(navigation, /return null/);
});

test("workflow pages avoid duplicated mode and local demo explanations", () => {
  const createPage = readFileSync("app/create-bounty/page.tsx", "utf8");
  const createForm = readFileSync("components/aleo-create-bounty-form.tsx", "utf8");
  const triagePage = readFileSync("app/triage/page.tsx", "utf8");
  const publicClaims = readFileSync("app/public-claims/page.tsx", "utf8");
  const bountyPanel = readFileSync("components/aleo-bounty-registry-panel.tsx", "utf8");
  const receiptPanel = readFileSync("components/aleo-claim-receipt-panel.tsx", "utf8");

  for (const [source, removedCopy] of [
    [createPage, "Real Mode 中，连接钱包将通过 std::ctx::signer()"],
    [createForm, "Owner 只来自 Program 的 std::ctx::signer()"],
    [createForm, "连接钱包后，该地址将作为 Bounty Owner 创建"],
    [triagePage, "Triage & Responsible Disclosure"],
    [triagePage, "当前 Demo 视角可推进所属 Bounty"],
    [publicClaims, "公开浏览模式"],
    [publicClaims, "本地演示 Registry"],
    [bountyPanel, "仅查询已部署 Program 的公开 mapping"],
    [receiptPanel, "公开字段由 submit_claim Final 原子写入"],
  ]) {
    assert.equal(source.includes(removedCopy), false, `${removedCopy} should not remain in workflow UI`);
  }
});

test("wallet diagnostics are available on demand without tiny always-on copy", () => {
  const control = readFileSync("components/wallet-connection-control.tsx", "utf8");

  assert.match(control, /<details/);
  assert.match(control, /Wallet extension unavailable/);
  assert.match(control, /Connection rejected \/ Wallet locked \/ Wrong network/);
  assert.equal(control.includes("text-[10px]"), false);
  assert.equal(control.includes("text-[11px]"), false);
});
