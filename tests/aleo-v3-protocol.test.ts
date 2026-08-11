import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("leo/bug_proof/src/main.leo", "utf8")
  .replace(/\r\n/g, "\n");

function entry(name: string) {
  const marker = "    fn " + name + "(";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, "Missing Leo entry: " + name);
  const nextEntry = source.indexOf("\n    fn ", start + marker.length);
  const constructor = source.indexOf("\n    @admin", start + marker.length);
  const end = nextEntry === -1 || (constructor !== -1 && constructor < nextEntry)
    ? constructor
    : nextEntry;
  assert.notEqual(end, -1, "Missing Leo entry boundary: " + name);
  return source.slice(start, end);
}

test("V3 receipt binds the proof to target, code, state, execution, and report commitments", () => {
  const submit = entry("submit_claim_v3");
  assert.match(submit, /binding\.target_system_commitment/);
  assert.match(submit, /binding\.target_state_commitment/);
  assert.match(submit, /binding\.target_code_hash/);
  assert.match(submit, /binding\.execution_commitment/);
  assert.match(submit, /binding\.report_commitment/);
  assert.match(submit, /assert_eq\(config\.target_system_commitment, bound_target_system\)/);
  assert.match(submit, /assert_eq\(config\.target_code_hash, bound_target_code\)/);
  assert.match(submit, /assert\(signer != bounty\.owner_address\)/);
  assert.match(submit, /proof_status: 1u8/);
  assert.match(submit, /protocol_version: 3u8/);
});

test("V3 Bounty config stores one immutable per-Bounty panel instead of a fixed program arbiter", () => {
  const create = entry("create_bounty_v3");
  assert.match(create, /arbiter_one != policy\.arbiter_two/);
  assert.match(create, /policy\.arbiter_one != signer/);
  assert.match(create, /policy\.quorum == 2u8 \|\| policy\.quorum == 3u8/);
  assert.match(create, /review_window_blocks > 0u32/);
  assert.match(create, /decision_window_blocks > 0u32/);
  assert.match(create, /arbitration_fee_microcredits > 0u64/);
  assert.equal(
    (source.match(/Mapping::set\(bounty_v3_configs, bounty_id, config\)/g) ?? []).length,
    1,
  );
});

test("V3 separates review, reward lock, encrypted delivery, reproduction, and patch actions", () => {
  const review = entry("review_claim_v3");
  const lock = entry("lock_reward_v3");
  const disclosure = entry("disclosure_action_v3");
  const resolution = entry("resolution_action_v3");

  assert.match(review, /action == 1u8 && current\.status == 1u8/);
  assert.match(review, /action == 2u8/);
  assert.match(review, /action == 3u8/);
  assert.doesNotMatch(review, /available_balance - reward_amount/);
  assert.match(lock, /assert_eq\(current\.status, 3u8\)/);
  assert.match(lock, /available_balance: escrow\.available_balance - reward_amount/);
  assert.match(disclosure, /signer == current\.whitehat_address/);
  assert.match(disclosure, /signer == bounty\.owner_address/);
  assert.match(disclosure, /claim_v3_acknowledgements/);
  assert.match(resolution, /current\.status == 6u8/);
  assert.match(resolution, /current\.status == 7u8/);
  assert.match(resolution, /current\.status == 9u8/);
  assert.match(resolution, /action == 5u8/);
  assert.match(resolution, /current\.status == 8u8/);
  assert.match(resolution, /current\.status == 13u8/);
  assert.match(resolution, /unresolved_claims - 1u64/);
});

test("V3 dispute escrows the configured bond and limits votes to the immutable panel", () => {
  const dispute = entry("dispute_claim_v3");
  const vote = entry("cast_arbitration_vote_v3");

  assert.match(dispute, /transfer_public_as_signer/);
  assert.match(dispute, /assert_eq\(fee_amount, config\.arbitration_fee_microcredits\)/);
  assert.match(dispute, /Mapping::set\(claim_v3_dispute_bonds, claim_hash, bond\)/);
  assert.match(dispute, /current\.updated_height \+ config\.review_window_blocks/);
  assert.ok(dispute.indexOf("Mapping::set(v3_operation_markers") < dispute.indexOf("transfer.run()"));

  assert.match(vote, /is_v3_panel_member\(config, signer\)/);
  assert.match(vote, /derive_v3_vote_key\(bounty_id, claim_hash, signer\)/);
  assert.match(vote, /verdict == 0u8 \|\| verdict <= receipt\.severity/);
  assert.match(vote, /current\.updated_height \+ config\.decision_window_blocks/);
  assert.match(vote, /!Mapping::contains\(claim_v3_arbitration_votes, vote_key\)/);
});

test("V3 panel outcomes and SLA defaults drive permissionless funds settlement", () => {
  const settle = entry("settle_reward_v3");
  const prelock = entry("finalize_arbitration_prelock_v3");
  const reject = entry("finalize_rejection_v3");
  const resolution = entry("resolution_action_v3");

  assert.doesNotMatch(settle, /assert_eq\(bounty\.owner_address, signer\)/);
  assert.match(settle, /config\.payment_condition == 1u8/);
  assert.match(settle, /config\.payment_condition == 2u8/);
  assert.match(settle, /v3_verdict_has_quorum\(tally, verdict, config\.quorum\)/);
  assert.match(settle, /verdict <= receipt\.severity/);
  assert.match(settle, /timeout_favors_whitehat/);
  assert.ok(settle.lastIndexOf("Mapping::set") < settle.lastIndexOf("transfer.run()"));

  assert.match(prelock, /assert\(!Mapping::contains\(claim_v3_payouts, claim_hash\)\)/);
  assert.match(prelock, /quorum_award \|\| timeout_favors_whitehat/);
  assert.match(prelock, /available_balance: escrow\.available_balance - reward_amount/);

  assert.match(reject, /v3_verdict_has_quorum\(tally, 0u8, config\.quorum\)/);
  assert.match(reject, /timeout_favors_owner/);
  assert.match(reject, /unresolved_claims - 1u64/);
  assert.match(reject, /Mapping::contains\(claim_v3_dispute_bonds, claim_hash\)/);
  assert.doesNotMatch(reject, /if has_bond/);
  assert.doesNotMatch(reject, /current\.status == 8u8/);
  assert.ok(reject.lastIndexOf("Mapping::set") < reject.lastIndexOf("transfer.run()"));
  assert.match(resolution, /valid_unappealed_rejection/);
});

test("V3 uses the full Leo entry budget without changing the preserved V1/V2 surface", () => {
  const programSource = source.slice(source.indexOf("program zkbugbounty_7f3c92.aleo"));
  const entries = [...programSource.matchAll(/\n    fn ([a-z_][a-z0-9_]*)\(/g)]
    .map((match) => match[1]);
  const v3Entries = [
    "create_bounty_v3",
    "submit_claim_v3",
    "fund_bounty_v3",
    "review_claim_v3",
    "lock_reward_v3",
    "disclosure_action_v3",
    "resolution_action_v3",
    "dispute_claim_v3",
    "cast_arbitration_vote_v3",
    "settle_reward_v3",
    "finalize_arbitration_prelock_v3",
    "finalize_rejection_v3",
    "refund_bounty_v3",
  ];
  assert.equal(entries.length, 31);
  for (const name of v3Entries) assert.ok(entries.includes(name), name);
  assert.equal(new Set(entries).size, entries.length);
});
