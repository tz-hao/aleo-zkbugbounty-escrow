import assert from "node:assert/strict";
import { test } from "node:test";

import { createAleoProgramEngine } from "../lib/proof-engines/index.ts";
import { readFileSync } from "node:fs";
import {
  addTriageNote,
  createBounty,
  createInitialDemoState,
  lockReward,
  markPatched,
  releaseBounty,
  requestEncryptedDetails,
  shareEncryptedDetails,
  submitClaim,
} from "../lib/store.ts";
import type { LeoCliDetection, LeoCommandRunner } from "../lib/leo-cli.ts";

const wslLeo: LeoCliDetection = {
  available: true,
  mode: "wsl",
  version: "leo 4.0.2",
  command: "wsl bash -lc",
};

const validLeoOutput = `
➡️  Output
• {
  verified: true,
  severity: 3u8,
  claim_hash: 15007field,
  witness_commitment: 9018field,
  nullifier: 10002field,
  reporter_commitment: 7007field,
  bug_type_id: 1field,
  rule_id: 1field
}
`;

test("full five-actor flow only persists public metadata", async () => {
  let state = createInitialDemoState();
  const owner = state.actors.find((actor) => actor.role === "ProjectOwner")!;
  const whitehat = state.actors.find((actor) => actor.role === "Whitehat")!;
  const publicUser = state.actors.find((actor) => actor.role === "PublicUser")!;

  state = createBounty(state, owner, {
    projectName: "Demo Vault",
    scope: "Vault accounting logic",
    bountyAmount: 100,
    rewards: { critical: 100, high: 50, medium: 20, low: 5 },
    ruleText: "vault_balance must never be lower than total_claims",
    disclosureDeadline: "7 days after verified claim",
  });

  const bounty = state.bounties[0];
  const runner: LeoCommandRunner = async () => ({
    exitCode: 0,
    stdout: validLeoOutput,
    stderr: "",
  });
  const proof = await createAleoProgramEngine(new Set(state.claims.map((claim) => claim.nullifier)), {
    detection: wslLeo,
    runner,
  }).generateProof(
    {
      vaultBalanceBefore: 100,
      totalClaimsBefore: 80,
      hiddenDeltaBalance: 40,
      hiddenDeltaClaims: 30,
      privateCallSequence: "private sequence",
      privateStateValues: "private state",
      reporterSecret: "flow-secret",
      bugType: "Vault accounting invariant breach",
    },
    bounty,
  );

  assert.equal(proof.verified, true);
  assert.match(proof.receiptId, /^leo-local:/);

  state = submitClaim(state, whitehat, bounty.id, proof);
  const claimId = state.claims[0].id;
  state = lockReward(state, owner, claimId, "Reward reserved for verified proof.");
  state = requestEncryptedDetails(state, owner, claimId, "Please share encrypted disclosure.");
  state = shareEncryptedDetails(state, whitehat, claimId, {
    packageHash: `0x${"a".repeat(64)}`,
    recipientKeyId: `0x${"b".repeat(64)}`,
  });
  const arbiter = state.actors.find((actor) => actor.role === "TriageArbiter")!;
  state = addTriageNote(state, arbiter, claimId, "Security Arbiter recommends severity: Critical.");
  state = markPatched(state, owner, claimId, "Patch shipped.");
  state = releaseBounty(state, owner, claimId, "Bounty released.");

  const finalClaim = state.claims.find((claim) => claim.id === claimId)!;
  assert.equal(finalClaim.disclosureStatus, "Patched");
  assert.equal(finalClaim.payoutStatus, "Paid");
  assert.equal(state.claimReceipts.some((receipt) => receipt.receiptId === finalClaim.receiptId), true);
  assert.equal(state.publicClaimRegistry.some((entry) => entry.registryKey === finalClaim.registryKey), true);
  assert.equal(state.nullifierRecords.some((record) => record.nullifier === finalClaim.nullifier), true);
  assert.equal(state.currentActor.id !== publicUser.id, true);
  assert.equal(JSON.stringify(finalClaim).includes("private sequence"), false);

  const disclosurePackage = state.disclosurePackages.find((item) => item.claimId === claimId)!;
  assert.equal(Boolean(disclosurePackage.packageHash), true);
  assert.equal(disclosurePackage.encryptedFor, owner.id);
  assert.equal(disclosurePackage.sharedBy, whitehat.id);
  assert.equal(disclosurePackage.status, "Shared");

  const serializedPackage = JSON.stringify(disclosurePackage);
  for (const forbidden of ["private sequence", "private state", "PoC", "exploit path", "private witness"]) {
    assert.equal(serializedPackage.includes(forbidden), false, `${forbidden} leaked into disclosure package`);
  }

  const publicClaimMetadata = {
    projectName: bounty.projectName,
    ruleName: finalClaim.ruleName,
    affectedModule: finalClaim.affectedModule,
    impact: finalClaim.impact,
    bugType: finalClaim.bugType,
    severity: finalClaim.severity,
    proofStatus: finalClaim.proofStatus,
    disclosureStatus: finalClaim.disclosureStatus,
    payoutStatus: finalClaim.payoutStatus,
    patchedStatus: finalClaim.disclosureStatus === "Patched" ? "Patched" : "Pending",
    paidStatus: finalClaim.payoutStatus === "Paid" ? "Paid" : "Pending",
    receiptId: finalClaim.receiptId,
    registryKey: finalClaim.registryKey,
  };

  assert.deepEqual(Object.keys(publicClaimMetadata).sort(), [
    "bugType",
    "affectedModule",
    "disclosureStatus",
    "impact",
    "paidStatus",
    "patchedStatus",
    "payoutStatus",
    "projectName",
    "proofStatus",
    "receiptId",
    "registryKey",
    "ruleName",
    "severity",
  ].sort());
});

test("Project Owner creates bounty with built-in rule selector", () => {
  const source = readFileSync("components/bounty-form.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${uiCopySource}`;

  for (const phrase of [
    "安全规则（Invariant）",
    "Vault Accounting Safety",
    "Claims 与 Deposits 安全",
    "Reward Reserve 安全",
    "Withdrawal Limit 安全",
    "受影响模块",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should appear in create bounty UI`);
  }
  assert.equal(source.includes("Rule Text"), false, "rule text must not be exposed as a free-form code input");
});

test("Whitehat sees dynamic witness form based on selected bounty rule", () => {
  const source = readFileSync("app/submit-proof/page.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${uiCopySource}`;

  for (const phrase of [
    "vault-accounting-safety",
    "claims-vs-deposits",
    "reward-reserve-safety",
    "withdraw-limit-safety",
    "hiddenDeltaWithdrawAmount",
    "hiddenDeltaUserBalance",
    "Private Witness 仅在当前设备内存中临时存在，不持久化。",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should appear in submit proof dynamic form`);
  }
});

test("Public User sees only public rule metadata", () => {
  const source = readFileSync("app/public-claims/page.tsx", "utf8");

  for (const phrase of ["Rule Name", "受影响模块", "Impact", "Proof Engine"]) {
    assert.equal(source.includes(phrase), true, `${phrase} should be public metadata`);
  }
  for (const forbidden of ["hiddenDeltaBalance", "hiddenDeltaClaims", "reporterSecret", "privateCallSequence"]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must not appear in public claims UI`);
  }
});
