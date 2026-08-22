import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectOnChainTriageAbi,
  ON_CHAIN_TRIAGE_CAPABILITY,
} from "../lib/aleo-triage.ts";
import { readCanonicalLeoSourceAbi } from "./helpers/leo-source-abi.ts";

test("local upgrade ABI contains the full on-chain triage boundary", () => {
  const inspection = inspectOnChainTriageAbi(readCanonicalLeoSourceAbi());
  assert.equal(inspection.available, true);
  assert.deepEqual(inspection.missingFunctions, []);
  assert.deepEqual(inspection.missingMappings, []);
});

test("Demo Preview cannot authorize or persist a Real Mode triage transition", () => {
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.walletActionsEnabled, false);
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.uiRoleSwitcherAuthority, false);
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.roleAuthority, "std::ctx::signer()");
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.stateAuthority, "AleoMapping");
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.transactionIdRequired, true);
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.mappingVerificationRequired, true);
  assert.equal(ON_CHAIN_TRIAGE_CAPABILITY.demoFallbackAllowed, false);
});

test("on-chain triage API refuses writes without parsing a request", () => {
  const route = readFileSync("app/api/aleo/triage/route.ts", "utf8");
  const status = readFileSync("components/reward-escrow-status.tsx", "utf8");
  assert.match(route, /status: 405/);
  assert.equal(route.includes("request.json"), false);
  assert.equal(route.includes("requestTransaction"), false);
  assert.match(status, /Program Upgrade Required/);
  assert.match(status, /Confirmed Transaction/);
});

test("historical V2 receipts do not reopen the removed V2 triage workspace", () => {
  const index = readFileSync("components/aleo-public-index.tsx", "utf8");
  const detail = readFileSync("app/public-claims/[registryKey]/page.tsx", "utf8");
  const triagePage = readFileSync("app/triage/page.tsx", "utf8");

  assert.doesNotMatch(index, /\/triage\?claimHash=/);
  assert.doesNotMatch(detail, /\/triage\?claimHash=/);
  assert.doesNotMatch(triagePage, /OnChainTriageWorkspace/);
  assert.match(triagePage, /ProtocolV3Workbench/);
});
