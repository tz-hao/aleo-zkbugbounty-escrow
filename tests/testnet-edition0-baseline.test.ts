import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TESTNET_EDITION_ZERO_FIXTURE_SHA256,
  materializeTestnetEditionZeroSource,
  sha256,
} from "../scripts/materialize-testnet-edition0-baseline.mjs";

const fixturePath = "audit/testnet-edition-0/zkbugbounty_7f3c92.edition-0.aleo";
const candidatePath = "leo/bug_proof/src/main.leo";

test("real Testnet edition 0 fixture is pinned and remains authoritative", () => {
  const fixture = readFileSync(fixturePath, "utf8");
  assert.equal(sha256(fixture), TESTNET_EDITION_ZERO_FIXTURE_SHA256);
  assert.match(fixture, /finalize submit_claim:/);
  assert.match(fixture, /input r7 as field\.public;/);
  assert.doesNotMatch(fixture, /input r8 as address\.public;/);
});

test("temporary Devnode baseline retains only the real edition 0 surface", () => {
  const generated = materializeTestnetEditionZeroSource(readFileSync(candidatePath, "utf8"));

  for (const required of [
    "fn submit_claim(",
    "fn create_bounty(",
    "fn pause_bounty(",
    "fn close_bounty(",
    "@admin(address =",
  ]) {
    assert.match(generated, new RegExp(required.replace(/[()]/g, "\\$&")));
  }

  for (const forbidden of [
    "fn submit_claim_v2(",
    "bounty_escrows",
    "claim_payouts",
    "bounty_claim_counts",
    "claim_reporters",
    "claim_triage_states",
    "bounty_protocol_versions",
    "escrow_operation_markers",
    "fn fund_bounty(",
    "fn lock_reward(",
    "fn release_reward(",
    "fn refund_bounty(",
  ]) {
    assert.doesNotMatch(generated, new RegExp(forbidden.replace(/[()]/g, "\\$&")));
  }
});