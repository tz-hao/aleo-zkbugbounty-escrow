import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildCastArbitrationVoteV3Transaction,
  buildCreateBountyV3Transaction,
  buildDisclosureActionV3Transaction,
  buildDisputeClaimV3Transaction,
  buildFinalizeArbitrationPrelockV3Transaction,
  buildFinalizeRejectionV3Transaction,
  buildFundBountyV3Transaction,
  buildLockRewardV3Transaction,
  buildRefundBountyV3Transaction,
  buildResolutionActionV3Transaction,
  buildReviewClaimV3Transaction,
  buildSettleRewardV3Transaction,
  buildTransientSubmitClaimV3Inputs,
  fetchProtocolV3Capability,
  inspectProtocolV3Source,
  PROTOCOL_V3_FUNCTIONS,
  PROTOCOL_V3_MAPPINGS,
} from "../lib/aleo-protocol-v3.ts";
import {
  ALEO_TESTNET_PROGRAM_OWNER,
  ALEO_TESTNET_V3_EDITION_TWO_EVIDENCE,
  ALEO_TESTNET_V3_UPGRADE_EVIDENCE,
} from "../lib/aleo-program.ts";
import {
  parseOnChainBountyV3Config,
  parseOnChainClaimV3ArbitrationTally,
  parseOnChainClaimV3DisputeBond,
  parseOnChainClaimV3Evidence,
  parseOnChainClaimV3Payout,
  parseOnChainClaimV3State,
} from "../lib/aleo-v3-registry.ts";
import { isEditionOneMappingName } from "../lib/testnet-edition-one.ts";
import { parseEditionTwoVerifierArguments } from "../scripts/verify-testnet-edition-2.mjs";
import {
  formatEditionThreeVerification,
  parseEditionThreeVerifierArguments,
} from "../scripts/verify-testnet-edition-3.mjs";
import type { OnChainBountyState } from "../lib/models.ts";

const ROOT = new URL("../", import.meta.url);
const compiledSource = readFileSync(
  new URL(
    "leo/bug_proof/build/zkbugbounty_7f3c92/zkbugbounty_7f3c92.aleo",
    ROOT,
  ),
  "utf8",
);
const leoSource = readFileSync(
  new URL("leo/bug_proof/src/main.leo", ROOT),
  "utf8",
);
const address = (character: string) => `aleo1${character.repeat(58)}`;
const config = {
  endpoint: "https://example.com",
  network: "testnet" as const,
  programId: "zkbugbounty_7f3c92.aleo",
};

const bounty: OnChainBountyState = {
  bountyId: "1field",
  owner: address("a"),
  scopeHash: "2field",
  ruleId: "vault-accounting-safety",
  rewards: {
    critical: "3000000",
    high: "2000000",
    medium: "1000000",
    low: "0",
  },
  disclosureDeadline: 20_000_000,
  status: "Active",
  source: "AleoTestnet",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
  mapping: "bounties",
};

test("Protocol V3 source inspection requires all 13 functions and 13 mappings", () => {
  for (const source of [compiledSource, leoSource]) {
    const inspection = inspectProtocolV3Source(source);
    assert.equal(inspection.available, true);
    assert.deepEqual(inspection.missingFunctions, []);
    assert.deepEqual(inspection.missingMappings, []);
  }
  assert.equal(PROTOCOL_V3_FUNCTIONS.length, 13);
  assert.equal(PROTOCOL_V3_MAPPINGS.length, 13);
  const incomplete = inspectProtocolV3Source(
    compiledSource.replace("function settle_reward_v3:", "function removed:"),
  );
  assert.equal(incomplete.available, false);
  assert.deepEqual(incomplete.missingFunctions, ["settle_reward_v3"]);
});

test("all 12 public V3 transaction builders preserve the Edition 3 ABI", () => {
  const common = { bountyId: "1field", claimHash: "3field", feeMicrocredits: 1_000_000 };
  const previews = [
    buildCreateBountyV3Transaction({
      bountyId: "1field",
      scopeHash: "2field",
      ruleId: "1field",
      criticalReward: "3000000",
      highReward: "2000000",
      mediumReward: "1000000",
      disclosureDeadline: 20_000_000,
      policy: {
        disclosureKeyCommitment: "4field",
        targetSystemCommitment: "5field",
        targetCodeHash: "6field",
        panelId: "7field",
        arbiters: [address("b"), address("c"), address("d")],
        quorum: 2,
        reviewWindowBlocks: 100,
        decisionWindowBlocks: 200,
        arbitrationFeeMicrocredits: "500000",
        paymentCondition: 1,
      },
      feeMicrocredits: 1_000_000,
    }),
    buildFundBountyV3Transaction({
      bountyId: "1field",
      amount: "3000000",
      fundingMarker: "10field",
      feeMicrocredits: 1_000_000,
    }),
    buildReviewClaimV3Transaction({
      ...common,
      action: 2,
      projectSeverity: 3,
      decisionCommitment: "11field",
      actionMarker: "12field",
    }),
    buildLockRewardV3Transaction({
      ...common,
      rewardAmount: "3000000",
      lockMarker: "13field",
    }),
    buildDisclosureActionV3Transaction({
      ...common,
      action: 1,
      actionCommitment: "14field",
      actionMarker: "15field",
    }),
    buildResolutionActionV3Transaction({
      ...common,
      action: 3,
      actionCommitment: "16field",
      actionMarker: "17field",
    }),
    buildDisputeClaimV3Transaction({
      ...common,
      disputeType: 1,
      requestedSeverity: 0,
      disputeCommitment: "18field",
      feeAmount: "500000",
      disputeMarker: "19field",
    }),
    buildCastArbitrationVoteV3Transaction({
      ...common,
      verdict: 2,
      voteMarker: "20field",
    }),
    buildSettleRewardV3Transaction({
      ...common,
      whitehatAddress: address("e"),
      rewardAmount: "2000000",
      bondAmount: "0",
      verdict: 0,
      marker: "21field",
    }),
    buildFinalizeArbitrationPrelockV3Transaction({
      ...common,
      whitehatAddress: address("e"),
      rewardAmount: "2000000",
      bondAmount: "500000",
      verdict: 2,
      marker: "22field",
    }),
    buildFinalizeRejectionV3Transaction({
      ...common,
      bondRecipient: address("a"),
      bondAmount: "500000",
      verdict: 0,
      rejectionMarker: "23field",
    }),
    buildRefundBountyV3Transaction({
      bountyId: "1field",
      amount: "1000000",
      refundMarker: "24field",
      feeMicrocredits: 1_000_000,
    }),
  ];
  assert.deepEqual(
    previews.map((preview) => preview.functionName),
    PROTOCOL_V3_FUNCTIONS.filter((name) => name !== "submit_claim_v3"),
  );
  const expectedCounts = [9, 3, 6, 4, 5, 5, 7, 4, 7, 7, 6, 3];
  assert.deepEqual(previews.map((preview) => preview.inputs.length), expectedCounts);
  assert.equal(JSON.stringify(previews).includes("reporterSecret"), false);
  assert.throws(
    () => buildCreateBountyV3Transaction({
      bountyId: "1field",
      scopeHash: "2field",
      ruleId: "1field",
      criticalReward: "100",
      highReward: "200",
      mediumReward: "50",
      disclosureDeadline: 20,
      policy: {
        disclosureKeyCommitment: "4field",
        targetSystemCommitment: "5field",
        targetCodeHash: "6field",
        panelId: "7field",
        arbiters: [address("b"), address("b"), address("d")],
        quorum: 2,
        reviewWindowBlocks: 1,
        decisionWindowBlocks: 1,
        arbitrationFeeMicrocredits: "1",
        paymentCondition: 1,
      },
      feeMicrocredits: 1,
    }),
    /reward tiers|distinct/i,
  );
});

test("submit_claim_v3 serializes bindings and private witness as two ABI structs", () => {
  const request = {
    bounty,
    latestBlockHeight: 19_000_000,
    feeMicrocredits: 1_000_000,
    binding: {
      targetSystemCommitment: "5field",
      targetStateCommitment: "6field",
      targetCodeHash: "7field",
      executionCommitment: "8field",
      reportCommitment: "9field",
    },
    witness: {
      vaultBalanceBefore: "1000",
      totalDepositsBefore: "1000",
      totalClaimsBefore: "100",
      reservedRewardsBefore: "100",
      withdrawLimitBefore: "100",
      userBalanceBefore: "100",
      requestedWithdrawBefore: "100",
      hiddenDeltaBalance: "200",
      hiddenDeltaClaims: "0",
      hiddenDeltaReservedRewards: "0",
      hiddenDeltaWithdrawAmount: "200",
      hiddenDeltaUserBalance: "0",
      reporterSecretField: "30field",
    },
  };
  const inputs = buildTransientSubmitClaimV3Inputs(request);
  assert.equal(inputs.length, 5);
  assert.equal(inputs[0], "1field");
  assert.match(inputs[3], /target_system_commitment: 5field/);
  assert.match(inputs[4], /vault_balance_before: 1000u64/);
  assert.match(inputs[4], /reporter_secret: 30field/);
});

test("V3 capability remains fail-closed until verified Edition 3 source evidence is available", async () => {
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/latest_edition")) {
      return new Response("1", { status: 200 });
    }
    return new Response(JSON.stringify(compiledSource), { status: 200 });
  };
  const editionOne = await fetchProtocolV3Capability(fetcher);
  assert.equal(editionOne.status, "ProgramUpgradeRequired");
  assert.equal(editionOne.walletRequestEnabled, false);
  assert.equal(editionOne.currentEdition, 1);

  const savedEvidence = {
    transactionId: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId,
    feeTransactionId: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId,
    compiledProgramSha256: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.compiledProgramSha256,
    onChainProgramSourceSha256: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.onChainProgramSourceSha256,
  };
  try {
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId = null;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId = null;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.compiledProgramSha256 = null;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.onChainProgramSourceSha256 = null;
    const pendingEvidence = await fetchProtocolV3Capability(async (input) => {
      const url = String(input);
      if (url.endsWith("/latest_edition")) {
        return new Response("3", { status: 200 });
      }
      return new Response(JSON.stringify(compiledSource), { status: 200 });
    });
    assert.equal(pendingEvidence.status, "DeploymentEvidencePending");
    assert.equal(pendingEvidence.walletRequestEnabled, false);
    assert.equal(pendingEvidence.upgradeEvidenceVerified, false);
  } finally {
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId = savedEvidence.transactionId;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId = savedEvidence.feeTransactionId;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.compiledProgramSha256 = savedEvidence.compiledProgramSha256;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.onChainProgramSourceSha256 = savedEvidence.onChainProgramSourceSha256;
  }

  ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId = "at1editionthreeevidence";
  ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId = "at1editionthreefee";
  ALEO_TESTNET_V3_UPGRADE_EVIDENCE.compiledProgramSha256 = createHash("sha256")
    .update(compiledSource)
    .digest("hex");
  ALEO_TESTNET_V3_UPGRADE_EVIDENCE.onChainProgramSourceSha256 = createHash("sha256")
    .update(compiledSource)
    .digest("hex");

  try {
    const verified = await fetchProtocolV3Capability(async (input) => {
      const url = String(input);
      if (url.endsWith("/latest_edition")) return new Response("3", { status: 200 });
      if (url.endsWith(`/transaction/${ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId}`)) {
        return Response.json({
          id: ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId,
          type: "deploy",
          owner: { address: ALEO_TESTNET_PROGRAM_OWNER },
          deployment: {
            edition: 3,
            program_owner: ALEO_TESTNET_PROGRAM_OWNER,
            program: compiledSource,
          },
        });
      }
      if (url.includes("/transaction/")) return Response.json({});
      return new Response(JSON.stringify(compiledSource), { status: 200 });
    });
    assert.equal(verified.status, "Available");
    assert.equal(verified.walletRequestEnabled, true);
    assert.equal(verified.upgradeEvidenceVerified, true);
    assert.equal(verified.programHashVerified, true);
  } finally {
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.transactionId = savedEvidence.transactionId;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.feeTransactionId = savedEvidence.feeTransactionId;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.compiledProgramSha256 = savedEvidence.compiledProgramSha256;
    ALEO_TESTNET_V3_UPGRADE_EVIDENCE.onChainProgramSourceSha256 = savedEvidence.onChainProgramSourceSha256;
  }
});

test("strict V3 Mapping parsers reject unknown fields and decode every public state family", () => {
  const policy = parseOnChainBountyV3Config(
    `{ bounty_id: 1field, disclosure_key_commitment: 2field, target_system_commitment: 3field, target_code_hash: 4field, panel_id: 5field, arbiter_one: ${address("b")}, arbiter_two: ${address("c")}, arbiter_three: ${address("d")}, quorum: 2u8, review_window_blocks: 100u32, decision_window_blocks: 200u32, arbitration_fee_microcredits: 500000u64, payment_condition: 1u8, configured_height: 300u32 }`,
    "1field",
    config,
  );
  assert.equal(policy.paymentCondition, "OnReproduction");
  assert.equal(policy.arbiters.length, 3);

  const evidence = parseOnChainClaimV3Evidence(
    "{ claim_hash: 10field, bounty_id: 1field, target_system_commitment: 3field, target_state_commitment: 6field, target_code_hash: 4field, execution_commitment: 7field, report_commitment: 8field, submitted_height: 301u32 }",
    "10field",
    config,
  );
  assert.equal(evidence.executionCommitment, "7field");

  const state = parseOnChainClaimV3State(
    `{ claim_hash: 10field, bounty_id: 1field, whitehat_address: ${address("e")}, status: 11u8, pre_dispute_status: 8u8, package_hash: 9field, reproduction_commitment: 11field, patch_commitment: 0field, dispute_commitment: 12field, updated_height: 302u32 }`,
    "10field",
    config,
  );
  assert.equal(state.status, "Disputed");
  assert.equal(state.preDisputeStatus, "ReproductionRejected");
  assert.equal(state.patchCommitment, null);

  const payout = parseOnChainClaimV3Payout(
    `{ claim_hash: 10field, bounty_id: 1field, whitehat_address: ${address("e")}, reserved_amount: 2000000u64, paid_amount: 0u64, status: 1u8, locked_height: 303u32, paid_height: 0u32, release_marker: 0field }`,
    "10field",
    config,
  );
  assert.equal(payout.status, "RewardLocked");

  const tally = parseOnChainClaimV3ArbitrationTally(
    "{ claim_hash: 10field, bounty_id: 1field, reject_votes: 0u8, medium_votes: 1u8, high_votes: 2u8, critical_votes: 0u8, updated_height: 304u32 }",
    "10field",
    config,
  );
  assert.equal(tally.highVotes, 2);

  const bond = parseOnChainClaimV3DisputeBond(
    `{ claim_hash: 10field, bounty_id: 1field, payer: ${address("e")}, amount: 500000u64, status: 1u8, settled_height: 0u32 }`,
    "10field",
    config,
  );
  assert.equal(bond.status, "Pending");

  assert.throws(
    () => parseOnChainClaimV3State(
      `{ claim_hash: 10field, bounty_id: 1field, whitehat_address: ${address("e")}, status: 1u8, pre_dispute_status: 0u8, package_hash: 0field, reproduction_commitment: 0field, patch_commitment: 0field, dispute_commitment: 0field, updated_height: 1u32, extra: 1field }`,
      "10field",
      config,
    ),
    /unexpected field/i,
  );
});

test("generic public Mapping allowlist includes all V3 mappings and Edition 2 evidence remains immutable", () => {
  for (const mapping of PROTOCOL_V3_MAPPINGS) {
    assert.equal(isEditionOneMappingName(mapping), true);
  }
  const parsed = parseEditionTwoVerifierArguments([]);
  assert.equal(parsed.expectedEdition, 2);
  assert.equal(parsed.upgradeTransactionId, ALEO_TESTNET_V3_EDITION_TWO_EVIDENCE.transactionId);
  assert.equal(parsed.feeTransactionId, ALEO_TESTNET_V3_EDITION_TWO_EVIDENCE.feeTransactionId);
});

test("Edition 3 verification pins source hash in addition to public upgrade evidence", () => {
  const parsed = parseEditionThreeVerifierArguments([
    "--upgrade-transaction-id", "at1editionthree",
    "--fee-transaction-id", "at1editionthreefee",
    "--program-sha256", "a".repeat(64),
    "--on-chain-program-sha256", "b".repeat(64),
  ]);
  assert.equal(parsed.expectedEdition, 3);
  assert.equal(parsed.compiledProgramSha256, "a".repeat(64));
  assert.equal(parsed.onChainProgramSourceSha256, "b".repeat(64));
  const output = formatEditionThreeVerification(
    {
      programId: "zkbugbounty_7f3c92.aleo",
      network: "testnet",
      expectedEdition: 3,
      observedEdition: 3,
      upgradeStatus: "confirmed",
      overallVerification: "PASS",
    },
    { expected: "a".repeat(64), actual: "a".repeat(64), matches: true },
  );
  assert.match(output, /On-chain Program source SHA-256 match: PASS/);
  assert.match(output, /Overall verification: PASS/);
});
