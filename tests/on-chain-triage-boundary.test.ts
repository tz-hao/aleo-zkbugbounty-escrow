import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectOnChainTriageAbi,
  ON_CHAIN_TRIAGE_CAPABILITY,
} from "../lib/aleo-triage.ts";

test("local upgrade ABI still reports triage-specific entries as unavailable", () => {
  const abi = JSON.parse(readFileSync("leo/bug_proof/build/abi.json", "utf8"));
  const inspection = inspectOnChainTriageAbi(abi);
  assert.equal(inspection.available, false);
  assert.deepEqual(inspection.missingFunctions, [
    "request_disclosure",
    "attest_encrypted_details",
    "mark_patched",
    "reject_claim",
  ]);
  assert.deepEqual(inspection.missingMappings, ["triage_states"]);
});

test("Demo Preview cannot authorize or persist a Real Mode triage transition", () => {
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.walletActionsEnabled, false);
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.uiRoleSwitcherAuthority, false);
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.roleAuthority, "self.signer");
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.stateAuthority, "AleoMapping");
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.transactionIdRequired, true);
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.mappingVerificationRequired, true);
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.demoFallbackAllowed, false);
});

test("on-chain triage API refuses writes without parsing a request", () => {
  const route = readFileSync("app/api/aleo/triage/route.ts", "utf8");
  const status = readFileSync("components/reward-escrow-status.tsx", "utf8");
  assert.match(route, /status: 409/);
  assert.equal(route.includes("request.json"), false);
  assert.equal(route.includes("requestTransaction"), false);
  assert.match(status, /Demo Preview/);
  assert.match(status, /self\.signer/);
});
