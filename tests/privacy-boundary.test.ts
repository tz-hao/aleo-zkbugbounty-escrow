import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createAleoProgramEngine } from "../lib/proof-engines/index.ts";
import { canViewPrivateWitness } from "../lib/permissions.ts";
import {
  assertNoPrivateFields,
  redactSensitiveText,
  sanitizeProofResult,
  sanitizePublicClaim,
} from "../lib/privacy-guards.ts";
import { addTriageNote, createInitialDemoState, submitClaim } from "../lib/store.ts";
import type { LeoCliDetection, LeoCommandRunner } from "../lib/leo-cli.ts";
import type { PrivateProofInput } from "../lib/proof-engines/types.ts";

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

async function generateAleoProof(input: PrivateProofInput) {
  const state = createInitialDemoState();
  const runner: LeoCommandRunner = async () => ({
    exitCode: 0,
    stdout: validLeoOutput,
    stderr: "",
  });

  return createAleoProgramEngine(new Set(), {
    detection: wslLeo,
    runner,
  }).generateProof(input, state.bounties[0]);
}

test("store and public claim never contain private proof input", async () => {
  const state = createInitialDemoState();
  const whitehat = state.actors.find((actor) => actor.role === "Whitehat")!;
  const proof = await generateAleoProof({
    vaultBalanceBefore: 100,
    totalClaimsBefore: 80,
    hiddenDeltaBalance: 40,
    hiddenDeltaClaims: 30,
    privateCallSequence: "do not persist this",
    privateStateValues: "do not persist state values",
    reporterSecret: "do-not-persist-secret",
    bugType: "Vault accounting invariant breach",
  });
  const nextState = submitClaim(state, whitehat, state.bounties[0].id, proof);
  const serialized = JSON.stringify(nextState);

  for (const forbidden of [
    "do not persist this",
    "do-not-persist-secret",
    "hiddenDelta",
    "hiddenDeltaReservedRewards",
    "hiddenDeltaWithdrawAmount",
    "hiddenDeltaUserBalance",
    "privateCallSequence",
    "privateStateValues",
    "reporterSecret",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} leaked into store`);
  }
});

test("privacy guards reject private fields and redact sensitive text", () => {
  assert.throws(
    () => assertNoPrivateFields({ hiddenDeltaBalance: 42 }),
    /hiddenDeltaBalance/,
  );
  assert.throws(
    () => assertNoPrivateFields({ note: "contains exploit path and PoC" }),
    /exploit path/,
  );

  const redacted = redactSensitiveText("private witness with reporterSecret and delta values");
  assert.equal(redacted.includes("private witness"), false);
  assert.equal(redacted.includes("reporterSecret"), false);
  assert.equal(redacted.includes("delta values"), false);
});

test("sanitized proof result and public claim expose only safe public metadata", async () => {
  const state = createInitialDemoState();
  const proof = await generateAleoProof({
    vaultBalanceBefore: 100,
    totalClaimsBefore: 80,
    hiddenDeltaBalance: 40,
    hiddenDeltaClaims: 30,
    privateCallSequence: "sensitive local sequence",
    privateStateValues: "sensitive state values",
    reporterSecret: "secret-for-nullifier",
    bugType: "Vault accounting invariant breach",
  });
  const taintedProof = {
    ...proof,
    hiddenDeltaBalance: 40,
    reporterSecret: "secret-for-nullifier",
    privateCallSequence: "sensitive local sequence",
  };
  const sanitizedProof = sanitizeProofResult(taintedProof);

  assert.equal(JSON.stringify(sanitizedProof).includes("hiddenDelta"), false);
  assert.equal(JSON.stringify(sanitizedProof).includes("secret-for-nullifier"), false);
  assertNoPrivateFields(sanitizedProof);

  const whitehat = state.actors.find((actor) => actor.role === "Whitehat")!;
  const nextState = submitClaim(state, whitehat, state.bounties[0].id, sanitizedProof);
  const publicClaim = sanitizePublicClaim(nextState.claims[0]);

  for (const forbiddenKey of ["witnessCommitment", "nullifier", "claimHash", "claimReceiptId"]) {
    assert.equal(Object.hasOwn(publicClaim, forbiddenKey), false, `${forbiddenKey} leaked into public claim`);
  }
  assertNoPrivateFields(publicClaim);
});

test("store public notes and persistable data are scrubbed of sensitive text", () => {
  const state = createInitialDemoState();
  const arbiter = state.actors.find((actor) => actor.role === "TriageArbiter")!;
  const nextState = addTriageNote(
    state,
    arbiter,
    state.claims[0].id,
    "Do not publish PoC or exploit path or triggering parameters",
  );
  const note = nextState.triageActions[0].publicNote;

  for (const forbidden of ["PoC", "exploit path", "triggering parameters"]) {
    assert.equal(note.includes(forbidden), false, `${forbidden} leaked into public note`);
  }
});

test("public and triage UI source excludes forbidden exploit detail terms", () => {
  const publicSource = readFileSync("app/public-claims/page.tsx", "utf8");
  const triageSource = readFileSync("app/triage/page.tsx", "utf8");
  const submitSource = readFileSync("app/submit-proof/page.tsx", "utf8");
  const combinedPublic = `${publicSource}\n${triageSource}`;

  for (const term of [
    "PoC",
    "exploit path",
    "triggering parameters",
    "private input",
    "hiddenDelta",
    "hiddenDeltaBalance",
    "hiddenDeltaClaims",
    "hiddenDeltaReservedRewards",
    "hiddenDeltaWithdrawAmount",
    "hiddenDeltaUserBalance",
    "reporterSecret",
  ]) {
    assert.equal(publicSource.includes(term), false, `${term} must not appear in public claims page`);
  }
  for (const term of ["privateCallSequence", "privateStateValues", "reporterSecret", "hiddenDelta", "showCommitment"]) {
    assert.equal(combinedPublic.includes(term), false, `${term} must not appear in public/triage UI`);
  }
  assert.equal(/console\.log/.test(submitSource), false, "submit proof must not log private input");
});

test("canViewPrivateWitness is always false", () => {
  for (const actor of createInitialDemoState().actors) {
    assert.equal(canViewPrivateWitness(actor), false);
  }
});

test("mock data contains only precomputed public commitments, never a reporter secret", () => {
  const source = readFileSync("lib/mock-data.ts", "utf8");

  assert.equal(source.includes("reporterSecret"), false);
  assert.equal(source.includes("createReporterCommitment"), false);
  assert.equal(source.includes("createNullifier"), false);
});
