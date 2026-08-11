import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDisputeClaimV3Transaction,
  PROTOCOL_V3_DISPUTE_TYPES,
} from "../lib/aleo-protocol-v3.ts";
import {
  parseOnChainClaimV3DisputeMetadata,
  parseOnChainClaimV3ProjectDecision,
} from "../lib/aleo-v3-registry.ts";

const source = readFileSync("leo/bug_proof/src/main.leo", "utf8")
  .replace(/\r\n/g, "\n");
const address = (character: string) => "aleo1" + character.repeat(58);
const config = {
  endpoint: "https://example.com",
  network: "testnet" as const,
  programId: "zkbugbounty_7f3c92.aleo",
};

function entry(name: string) {
  const start = source.indexOf("    fn " + name + "(");
  assert.notEqual(start, -1, "Missing Leo entry: " + name);
  const end = source.indexOf("\n    fn ", start + 1);
  assert.notEqual(end, -1, "Missing Leo entry boundary: " + name);
  return source.slice(start, end);
}

test("six public dispute discriminators are stable and exhaustive", () => {
  assert.deepEqual(PROTOCOL_V3_DISPUTE_TYPES, {
    Rejection: 1,
    Duplicate: 2,
    Scope: 3,
    Severity: 4,
    Reproduction: 5,
    Remediation: 6,
  });
  const dispute = entry("dispute_claim_v3");
  assert.match(dispute, /dispute_type == 1u8[\s\S]*dispute_type == 6u8/);
  assert.doesNotMatch(dispute, /dispute_type == 0u8/);
});

test("wallet builder rejects invalid or mismatched public dispute routing", () => {
  const valid = buildDisputeClaimV3Transaction({
    bountyId: "1field",
    claimHash: "2field",
    disputeType: PROTOCOL_V3_DISPUTE_TYPES.Severity,
    requestedSeverity: 3,
    disputeCommitment: "3field",
    feeAmount: "500000",
    disputeMarker: "4field",
    feeMicrocredits: 1_000_000,
  });
  assert.deepEqual(valid.inputs.slice(2, 4), ["4u8", "3u8"]);

  const base = {
    bountyId: "1field",
    claimHash: "2field",
    disputeCommitment: "3field",
    feeAmount: "500000",
    disputeMarker: "4field",
    feeMicrocredits: 1_000_000,
  };
  assert.throws(
    () => buildDisputeClaimV3Transaction({
      ...base,
      disputeType: 0 as never,
      requestedSeverity: 0,
    }),
    /outside the supported range/i,
  );
  assert.throws(
    () => buildDisputeClaimV3Transaction({
      ...base,
      disputeType: PROTOCOL_V3_DISPUTE_TYPES.Duplicate,
      requestedSeverity: 2,
    }),
    /only severity disputes/i,
  );
});

test("public project decisions and immutable dispute metadata parse strictly", () => {
  const decision = parseOnChainClaimV3ProjectDecision(
    "{ claim_hash: 10field, bounty_id: 1field, decision: 5u8, project_severity: 2u8, decision_commitment: 11field, decided_height: 12u32 }",
    "10field",
    config,
  );
  assert.equal(decision.decision, "Severity");
  assert.equal(decision.projectSeverityCode, 2);

  const metadata = parseOnChainClaimV3DisputeMetadata(
    "{ claim_hash: 10field, bounty_id: 1field, dispute_type: 4u8, dispute_commitment: 13field, opener: " + address("a") + ", opened_height: 14u32, status: 1u8, requested_severity: 3u8, final_severity: 0u8 }",
    "10field",
    config,
  );
  assert.equal(metadata.disputeType, "Severity");
  assert.equal(metadata.status, "Open");
  assert.equal(metadata.disputeCommitment, "13field");

  assert.throws(
    () => parseOnChainClaimV3DisputeMetadata(
      "{ claim_hash: 10field, bounty_id: 1field, dispute_type: 7u8, dispute_commitment: 13field, opener: " + address("a") + ", opened_height: 14u32, status: 1u8, requested_severity: 0u8, final_severity: 0u8 }",
      "10field",
      config,
    ),
    /dispute type is unsupported/i,
  );
});

test("each dispute type is tied to an adverse decision and constrained ruling", () => {
  const dispute = entry("dispute_claim_v3");
  const vote = entry("cast_arbitration_vote_v3");
  const resolution = entry("resolution_action_v3");
  assert.match(dispute, /decision\.decision == 2u8/);
  assert.match(dispute, /decision\.decision == 3u8/);
  assert.match(dispute, /decision\.decision == 4u8/);
  assert.match(dispute, /decision\.decision == 5u8/);
  assert.match(dispute, /decision\.decision == 6u8/);
  assert.match(dispute, /decision\.decision == 7u8/);
  assert.match(vote, /let binary_ruling: bool/);
  assert.match(vote, /metadata\.dispute_type == 4u8/);
  assert.match(vote, /verdict <= receipt\.severity/);
  assert.match(resolution, /valid_arbitrated_reproduction/);
  assert.match(resolution, /config\.payment_condition == 2u8/);
});

test("post-arbitration settlement must use the stored final severity", () => {
  const settle = entry("settle_reward_v3");
  assert.match(settle, /metadata\.status == 2u8/);
  assert.match(settle, /assert_eq\(verdict, metadata\.final_severity\);/);
  assert.match(settle, /reward_for_v3_severity\(\s*bounty,\s*selected_severity,/);
});
