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
});

test("V3 Bounty config fixes one immutable panel and never rewrites it", () => {
  const create = entry("create_bounty_v3");
  assert.match(create, /policy\.quorum == 2u8 \|\| policy\.quorum == 3u8/);
  assert.match(create, /policy\.arbiter_one != signer/);
  assert.equal(
    (source.match(/Mapping::set\(bounty_v3_configs, bounty_id, config\)/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(source, /Mapping::remove\(bounty_v3_configs/);
});

test("V3 persists typed disputes plus bounded SLA escalation in independent rounds", () => {
  const review = entry("review_claim_v3");
  const resolution = entry("resolution_action_v3");
  const dispute = entry("dispute_claim_v3");

  assert.match(source, /struct ClaimV3ProjectDecision/);
  assert.match(source, /struct ClaimV3DisputeMetadata/);
  assert.match(source, /mapping claim_v3_project_decisions/);
  assert.match(source, /mapping claim_v3_dispute_metadata/);
  assert.match(review, /action >= 1u8 && action <= 6u8/);
  assert.match(review, /action == 4u8/);
  assert.match(review, /action == 5u8/);
  assert.match(review, /action == 6u8/);
  assert.match(review, /Mapping::set\(claim_v3_project_decisions, claim_hash, decision\)/);
  assert.match(resolution, /decision_code: u8 = action == 2u8 \? 6u8 : 7u8/);
  assert.match(resolution, /claim_v3_project_decisions/);
  assert.match(dispute, /dispute_type == 1u8/);
  assert.match(dispute, /dispute_type == 2u8/);
  assert.match(dispute, /dispute_type == 3u8/);
  assert.match(dispute, /dispute_type == 4u8/);
  assert.match(dispute, /dispute_type == 5u8/);
  assert.match(dispute, /dispute_type == 6u8/);
  assert.match(dispute, /dispute_type == 7u8/);
  assert.match(dispute, /decision\.decision == 2u8/);
  assert.match(dispute, /decision\.decision == 3u8/);
  assert.match(dispute, /decision\.decision == 4u8/);
  assert.match(dispute, /decision\.decision == 5u8/);
  assert.match(dispute, /decision\.decision == 6u8/);
  assert.match(dispute, /decision\.decision == 7u8/);
  assert.match(source, /mapping claim_v3_dispute_rounds/);
  assert.match(source, /mapping claim_v3_active_disputes/);
  assert.match(dispute, /derive_v3_dispute_id/);
  assert.match(dispute, /Mapping::set\(claim_v3_dispute_metadata, dispute_id, metadata\)/);
  assert.match(dispute, /owner_sla_timeout/);
  assert.match(dispute, /whitehat_sla_timeout/);
});

test("V3 constrains rulings and settlement routes by dispute type", () => {
  const vote = entry("cast_arbitration_vote_v3");
  const settle = entry("settle_reward_v3");
  const prelock = entry("finalize_arbitration_prelock_v3");
  const reject = entry("finalize_rejection_v3");

  assert.match(vote, /is_v3_panel_member\(config, signer\)/);
  assert.match(vote, /derive_v3_vote_key\(bounty_id, dispute_id, signer\)/);
  assert.match(vote, /binary_ruling/);
  assert.match(vote, /severity_ruling/);
  assert.match(vote, /!Mapping::contains\(claim_v3_arbitration_votes, vote_key\)/);

  assert.match(prelock, /valid_prelock_type/);
  assert.match(prelock, /metadata\.dispute_type == 4u8/);
  assert.match(prelock, /Mapping::set\(claim_v3_dispute_metadata, dispute_id, accepted_metadata\)/);

  assert.match(settle, /metadata\.dispute_type == 5u8/);
  assert.match(settle, /metadata\.dispute_type == 7u8/);
  assert.match(settle, /reproduction_award/);
  assert.match(settle, /sla_timeout_award/);
  assert.match(settle, /post_arbitration_award/);
  assert.match(reject, /remediation_dispute/);
  assert.match(reject, /remediation_ruling/);
  assert.match(reject, /next_status: u8 = remediation_accepted \? 10u8 : 7u8/);
});

test("V3 locks a reviewed severity and binds encrypted delivery to the initial report commitment", () => {
  const lock = entry("lock_reward_v3");
  const delivery = entry("disclosure_action_v3");
  const settle = entry("settle_reward_v3");
  assert.match(lock, /decision\.project_severity/);
  assert.match(lock, /let lock_severity: u8/);
  assert.match(delivery, /action_commitment == evidence\.report_commitment/);
  assert.match(settle, /assert_eq\(reward_amount, payout\.reserved_amount\)/);
});

test("V3 browser entry points require verified Program source evidence", () => {
  for (const path of [
    "components/aleo-create-bounty-v3-form.tsx",
    "components/aleo-submit-claim-v3-panel.tsx",
    "components/protocol-v3-workbench.tsx",
    "components/aleo-wallet-provider.tsx",
  ]) {
    assert.match(readFileSync(path, "utf8"), /programHashVerified/);
  }
});

test("V3 writes state and replay guards before every Credits Final", () => {
  for (const name of [
    "fund_bounty_v3",
    "dispute_claim_v3",
    "settle_reward_v3",
    "finalize_arbitration_prelock_v3",
    "finalize_rejection_v3",
    "refund_bounty_v3",
  ]) {
    const body = entry(name);
    assert.ok(body.lastIndexOf("Mapping::set") < body.lastIndexOf("transfer.run()"), name);
  }
});

test("frozen legacy fund_bounty fails before Final and leaves its CEI warning unreachable", () => {
  const legacyFund = entry("fund_bounty");
  const firstGuard = legacyFund.indexOf("assert_eq(amount, 0u64);");
  const contradictoryGuard = legacyFund.indexOf("assert_neq(amount, 0u64);");
  const creditsFinal = legacyFund.indexOf("let transfer: Final");
  const finalizer = legacyFund.indexOf("return final {");

  assert.ok(firstGuard >= 0 && contradictoryGuard > firstGuard);
  assert.ok(creditsFinal > contradictoryGuard);
  assert.ok(finalizer > creditsFinal);
  assert.match(legacyFund, /transfer\.run\(\)/);
});

test("V3 uses the full Leo entry budget without changing the preserved V1/V2 surface", () => {
  const programSource = source.slice(source.indexOf("program zkbugbounty_7f3c92.aleo"));
  const entries = [...programSource.matchAll(/\n    fn ([a-z_][a-z0-9_]*)\(/g)]
    .map((match) => match[1]);
  assert.equal(entries.length, 31);
  assert.equal(new Set(entries).size, entries.length);
  for (const name of [
    "create_bounty_v3",
    "review_claim_v3",
    "dispute_claim_v3",
    "cast_arbitration_vote_v3",
    "finalize_rejection_v3",
  ]) assert.ok(entries.includes(name), name);
});
