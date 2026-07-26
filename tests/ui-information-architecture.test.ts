import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Real Mode identity is derived from wallet and mapping, not Demo Preview", () => {
  const navigation = readFileSync("components/navigation.tsx", "utf8");
  const createForm = readFileSync("components/aleo-create-bounty-form.tsx", "utf8");
  const submitPage = readFileSync("app/submit-proof/page.tsx", "utf8");

  assert.equal(navigation.includes("useAppState"), false);
  assert.equal(navigation.includes("switchActor"), false);
  assert.equal(createForm.includes("canCreateBounty"), false);
  assert.equal(createForm.includes("currentActor"), false);
  assert.match(createForm, /self\.signer/);

  const walletRequest = submitPage.slice(
    submitPage.indexOf("async function requestWalletSignedClaim"),
    submitPage.indexOf("function publishClaim"),
  );
  assert.equal(walletRequest.includes("demoAllowed"), false);
  assert.match(submitPage, /当前钱包将作为 Whitehat \/ Reporter/);
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

test("homepage is a focused protocol entry without local or registry metrics", () => {
  const dashboard = readFileSync("components/dashboard.tsx", "utf8");

  assert.equal(dashboard.includes("useAppState"), false);
  assert.equal(dashboard.includes("AleoRegistryOverview"), false);
  assert.match(dashboard, /home-immersive/);
  assert.match(dashboard, /HeroProofVisual/);
  assert.match(dashboard, /href="\/submit-proof"/);
});

test("wallet diagnostics are available on demand without tiny always-on copy", () => {
  const control = readFileSync("components/wallet-connection-control.tsx", "utf8");

  assert.match(control, /<details/);
  assert.match(control, /Wallet extension unavailable/);
  assert.match(control, /Connection rejected \/ Wallet locked \/ Wrong network/);
  assert.equal(control.includes("text-[10px]"), false);
  assert.equal(control.includes("text-[11px]"), false);
});
