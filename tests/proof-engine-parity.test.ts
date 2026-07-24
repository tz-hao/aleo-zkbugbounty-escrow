import assert from "node:assert/strict";
import { test } from "node:test";

import { createAleoProgramEngine, createMockVaultEngine } from "../lib/proof-engines/index.ts";
import { createInitialDemoState } from "../lib/store.ts";
import type { PrivateProofInput } from "../lib/proof-engines/types.ts";
import type { LeoCliDetection, LeoCommandRunner } from "../lib/leo-cli.ts";

const baseInput: PrivateProofInput = {
  vaultBalance: 100,
  totalClaims: 80,
  hiddenDeltaBalance: 90,
  hiddenDeltaClaims: 30,
  privateCallSequence: "parity local sequence",
  privateStateValues: "parity local state",
  reporterSecret: "parity-secret",
  bugType: "Vault accounting invariant breach",
};

const wslLeo: LeoCliDetection = {
  available: true,
  mode: "wsl",
  version: "leo 4.0.2",
  command: "wsl bash -lc",
};

function leoOutput(verified: boolean, severity: number) {
  return `
➡️  Output
• {
  verified: ${verified},
  severity: ${severity}u8,
  claim_hash: 15007field,
  witness_commitment: 9018field,
  nullifier: 10002field,
  reporter_commitment: 7007field,
  bug_type_id: 1field,
  rule_id: 1field
}
`;
}

function fakeLeoRunnerFor(input: PrivateProofInput): LeoCommandRunner {
  return async () => {
    const initialStateValid = input.vaultBalance >= input.totalClaims;
    const vaultBalanceAfter = input.vaultBalance - input.hiddenDeltaBalance;
    const totalClaimsAfter = input.totalClaims + input.hiddenDeltaClaims;
    const impact = totalClaimsAfter - vaultBalanceAfter;
    const severity = impact >= 100 ? 3 : impact >= 50 ? 2 : impact >= 10 ? 1 : 0;
    const verified = initialStateValid && vaultBalanceAfter < totalClaimsAfter && severity >= 1;

    return {
      exitCode: 0,
      stdout: leoOutput(verified, severity),
      stderr: "",
    };
  };
}

async function compareSemantics(input: PrivateProofInput) {
  const state = createInitialDemoState();
  const bounty = state.bounties[0];
  const mock = await createMockVaultEngine().generateProof(input, bounty);
  const aleo = await createAleoProgramEngine(new Set(), {
    detection: wslLeo,
    runner: fakeLeoRunnerFor(input),
  }).generateProof(input, bounty);

  assert.equal(aleo.verified, mock.verified);
  assert.equal(aleo.proofStatus, mock.proofStatus);
  assert.equal(aleo.severity, mock.severity);
  assert.equal(aleo.bugType, "Vault Accounting Invariant Break");
  assert.equal(aleo.scopeHash, mock.scopeHash);
  assert.equal(aleo.ruleId, mock.ruleId);
}

test("aleo program semantics match mock engine for valid input", async () => {
  await compareSemantics(baseInput);
});

test("aleo program semantics reject invalid input like mock engine", async () => {
  await compareSemantics({ ...baseInput, hiddenDeltaBalance: 5, hiddenDeltaClaims: 5 });
});

test("aleo program semantics do not verify low-impact input like mock engine", async () => {
  await compareSemantics({
    ...baseInput,
    hiddenDeltaBalance: 1,
    hiddenDeltaClaims: 1,
    reporterSecret: "low-impact-parity-secret",
  });
});
