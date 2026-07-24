import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DEMO_VAULT_RULES } from "../lib/demo-vault.ts";
import { createMockVaultEngine } from "../lib/proof-engines/index.ts";
import { createBounty, createInitialDemoState, submitClaim } from "../lib/store.ts";
import { DEFAULT_PROTOCOL_VERSION } from "../lib/protocol/crypto.ts";
import type { Bounty, ProofResult } from "../lib/models.ts";

function aleoVerifiedProof(overrides: Partial<ProofResult> = {}): ProofResult {
  const state = createInitialDemoState();
  const bounty = state.bounties[0];
  return {
    verified: true,
    claimHash: "0xa111111111111111",
    witnessCommitment: "0xb222222222222222",
    nullifier: "0xc333333333333333",
    reporterCommitment: "0xd444444444444444",
    receiptId: "0xe555555555555555",
    registryKey: "0xf666666666666666",
    bugType: "Vault accounting invariant breach",
    severity: "Critical",
    proofStatus: "Verified",
    scopeHash: bounty.scopeHash,
    ruleId: bounty.ruleId,
    ruleName: bounty.ruleName,
    affectedModule: bounty.affectedModule,
    impact: 100,
    proofEngine: "Aleo Leo Proof",
    protocolVersion: DEFAULT_PROTOCOL_VERSION,
    ...overrides,
  };
}

test("submit proof page isolates Mock Demo Mode from Wallet device-side Real Mode", () => {
  const source = readFileSync("app/submit-proof/page.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${uiCopySource}`;

  for (const expected of [
    "Mock Invariant Engine",
    "Demo Mode",
    "Device-side Proof",
    "Wallet-signed submit_claim",
    "submitWalletClaim",
    "/api/aleo/bounties/",
    "/api/aleo/network",
    "clearPrivateInputState",
    "Wallet 成功、拒绝或异常后都会清空页面私密输入",
    "vault-accounting-safety",
    "claims-vs-deposits",
    "reward-reserve-safety",
    "withdraw-limit-safety",
  ]) {
    assert.equal(combinedSource.includes(expected), true, `${expected} must be present in submit proof flow`);
  }

  assert.equal(source.includes("console.log"), false, "submit proof page must not log private proof input");
  assert.equal(source.includes("/api/aleo/prove"), false, "Real Mode must not send witness to Next.js");
  assert.equal(source.includes("generateAleoProof"), false, "server-side proof helper must be removed");
  assert.match(source, /finally\s*\{[\s\S]*?clearPrivateInputState\(\)/);
});

const witnessByRule = {
  "vault-accounting-safety": {
    vaultBalance: 100,
    totalClaims: 80,
    hiddenDeltaBalance: 90,
    hiddenDeltaClaims: 30,
  },
  "claims-vs-deposits": {
    totalDeposits: 100,
    totalClaims: 80,
    hiddenDeltaClaims: 30,
  },
  "reward-reserve-safety": {
    vaultBalance: 100,
    reservedRewards: 20,
    hiddenDeltaBalance: 40,
    hiddenDeltaReservedRewards: 90,
  },
  "withdraw-limit-safety": {
    withdrawLimit: 50,
    userBalance: 40,
    requestedWithdrawAmount: 20,
    hiddenDeltaWithdrawAmount: 35,
    hiddenDeltaUserBalance: 10,
  },
} as const;

function bountyInputForRule(ruleId: Bounty["ruleId"]) {
  const rule = DEMO_VAULT_RULES.find((item) => item.id === ruleId);
  assert.ok(rule);
  return {
    projectName: `Demo ${rule.name}`,
    scope: rule.affectedModule,
    bountyAmount: 100,
    rewards: { critical: 100, high: 50, medium: 20, low: 5 },
    ruleId,
    ruleText: rule.invariantText,
    disclosureDeadline: "7 days after verified claim",
  };
}

test("create bounty and submit proof for each built-in rule using Mock Engine", async () => {
  const owner = createInitialDemoState().actors.find((actor) => actor.role === "ProjectOwner")!;
  const whitehat = createInitialDemoState().actors.find((actor) => actor.role === "Whitehat")!;

  for (const rule of DEMO_VAULT_RULES) {
    let state = createInitialDemoState();
    state = createBounty(state, owner, bountyInputForRule(rule.id));
    const bounty = state.bounties[0];
    const proof = await createMockVaultEngine(new Set(state.claims.map((claim) => claim.nullifier))).generateProof(
      {
        ...witnessByRule[rule.id],
        reporterSecret: `submit-${rule.id}`,
      },
      bounty,
    );
    const nextState = submitClaim(state, whitehat, bounty.id, proof);

    assert.equal(proof.verified, true, `${rule.id} proof should verify`);
    assert.equal(nextState.claims[0].ruleName, rule.name);
    assert.equal(nextState.claimReceipts[0].ruleName, rule.name);
    assert.equal(nextState.publicClaimRegistry[0].ruleName, rule.name);
    assert.equal(nextState.publicClaimRegistry[0].affectedModule, rule.affectedModule);
    assert.equal(nextState.publicClaimRegistry[0].impact, proof.impact);
  }
});

test("submit claim rejects duplicate nullifier with explicit user-facing message", () => {
  const initial = createInitialDemoState();
  const whitehat = initial.actors.find((actor) => actor.role === "Whitehat")!;
  const bounty = initial.bounties[0];
  const proof = aleoVerifiedProof();
  const nextState = submitClaim(initial, whitehat, bounty.id, proof);

  assert.throws(
    () => submitClaim(nextState, whitehat, bounty.id, proof),
    /Duplicate claim detected\./,
  );
});

test("aleo verified proof continues into public claim and receipt metadata only", () => {
  const initial = createInitialDemoState();
  const whitehat = initial.actors.find((actor) => actor.role === "Whitehat")!;
  const bounty = initial.bounties[0];
  const nextState = submitClaim(initial, whitehat, bounty.id, aleoVerifiedProof());
  const claim = nextState.claims[0];
  const receipt = nextState.claimReceipts[0];

  assert.equal(claim.proofStatus, "Verified");
  assert.equal(claim.severity, "Critical");
  assert.equal(claim.receiptId, "0xe555555555555555");
  assert.equal(claim.registryKey, "0xf666666666666666");
  assert.equal(receipt.proofEngine, "Aleo Leo Proof");
  assert.equal(nextState.publicClaimRegistry[0].registryKey, claim.registryKey);
  assert.equal(nextState.nullifierRecords[0].nullifier, claim.nullifier);
  const serialized = JSON.stringify(nextState);
  for (const forbidden of [
    "privateCallSequence",
    "privateStateValues",
    "reporterSecret",
    "hiddenDelta",
    "PoC",
    "exploit path",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} leaked into submitted state`);
  }
});
