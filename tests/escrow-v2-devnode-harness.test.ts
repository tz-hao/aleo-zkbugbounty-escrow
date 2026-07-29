import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const harness = readFileSync("scripts/escrow-v2-devnode-e2e.sh", "utf8");

test("Escrow Devnode harness is localhost-only and starts from an isolated ledger", () => {
  assert.match(harness, /http:\/\/127\.0\.0\.1:3030\|http:\/\/localhost:3030/);
  assert.match(harness, /refusing non-local endpoint/);
  assert.match(harness, /aleo-devnode-baseline/);
  assert.match(harness, /aleo-devnode-candidate/);
  assert.match(harness, /aleo-devnode-ledger/);
  assert.match(harness, /leo devnode start --devnet/);
  assert.match(harness, /--home "\$\{LEDGER_DIR\}"/);
  assert.doesNotMatch(harness, /api\.explorer\.provable\.com/);
  assert.doesNotMatch(harness, /--storage|--clear-storage/);
});

test("Escrow Devnode harness never embeds or persists private credentials", () => {
  assert.match(harness, /set \+x/);
  assert.match(harness, /read -r -s -p/);
  assert.match(harness, /trap cleanup EXIT INT TERM/);
  assert.match(harness, /unset PRIVATE_KEY OWNER_KEY WHITEHAT_KEY ARBITER_KEY/);
  assert.match(harness, /privateInputsPersisted: false/);
  assert.match(harness, /localKeysPersisted: false/);
  assert.doesNotMatch(harness, new RegExp(["APrivate", "Key"].join("")));
  assert.doesNotMatch(harness, /\.env/);
  assert.doesNotMatch(harness, /json-output|--save/);
});

test("Escrow Devnode harness uses real local transactions for baseline isolation", () => {
  assert.match(harness, /deploy --broadcast --yes --skip-deploy-certificate/);
  assert.match(harness, /upgrade --broadcast --yes --skip-deploy-certificate/);
  assert.match(harness, /execute .*--skip-execute-proof --broadcast --yes/);
  assert.match(harness, /query transaction/);
  assert.match(harness, /query program/);
  assert.match(harness, /v1_bounty_before_upgrade/);
  assert.match(harness, /v1_bounty_after_upgrade/);
  assert.match(harness, /fund_v1_bounty/);
  assert.match(harness, /lock_v1_claim/);
  assert.match(harness, /refund_v1_bounty/);
  assert.match(harness, /BLOCKED_LOCAL_KEY_EXECUTION_REQUIRED/);
});
