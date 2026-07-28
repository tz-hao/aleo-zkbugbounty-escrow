import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { OnChainBountyState, OnChainClaimReceipt } from "../lib/models.ts";
import {
  buildAttestEncryptedDetailsTransaction,
  buildFundBountyTransaction,
  buildLockRewardTransaction,
  buildMarkPatchedTransaction,
  buildRefundBountyTransaction,
  buildRejectClaimTransaction,
  buildReleaseRewardTransaction,
  buildRequestDisclosureTransaction,
  fetchRewardEscrowCapability,
} from "../lib/aleo-reward-escrow.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";

const address = `aleo1${"a".repeat(58)}`;
const bounty: OnChainBountyState = {
  bountyId: "100field",
  owner: address,
  scopeHash: "101field",
  ruleId: "vault-accounting-safety",
  rewards: {
    critical: "300",
    high: "200",
    medium: "100",
    low: "0",
  },
  disclosureDeadline: 20_000_000,
  status: "Active",
  source: "AleoTestnet",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
  mapping: "bounties",
};
const receipt: OnChainClaimReceipt = {
  claimHash: "200field",
  bountyId: bounty.bountyId,
  ruleId: bounty.ruleId,
  scopeHash: bounty.scopeHash,
  severity: "High",
  witnessCommitment: "201field",
  nullifier: "202field",
  reporterCommitment: "203field",
  proofStatus: "Verified",
  createdHeight: 19_000_000,
  protocolVersion: 2,
  source: "AleoTestnet",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
  mapping: "claim_receipts",
};

test("Escrow transaction builders follow the local upgrade ABI and fixed reward tiers", () => {
  const previews = [
    buildFundBountyTransaction({
      bountyId: bounty.bountyId,
      amount: "1000",
      fundingMarker: "300field",
      feeMicrocredits: 1_000_000,
    }),
    buildLockRewardTransaction({
      bounty,
      receipt,
      whitehatAddress: address,
      lockMarker: "305field",
      feeMicrocredits: 1_000_000,
    }),
    buildRequestDisclosureTransaction({
      bountyId: bounty.bountyId,
      claimHash: receipt.claimHash,
      requestMarker: "306field",
      feeMicrocredits: 1_000_000,
    }),
    buildAttestEncryptedDetailsTransaction({
      bountyId: bounty.bountyId,
      claimHash: receipt.claimHash,
      packageHash: "301field",
      shareMarker: "307field",
      feeMicrocredits: 1_000_000,
    }),
    buildMarkPatchedTransaction({
      bountyId: bounty.bountyId,
      claimHash: receipt.claimHash,
      patchedMarker: "308field",
      feeMicrocredits: 1_000_000,
    }),
    buildReleaseRewardTransaction({
      bounty,
      receipt,
      whitehatAddress: address,
      releaseMarker: "302field",
      feeMicrocredits: 1_000_000,
    }),
    buildRejectClaimTransaction({
      bountyId: bounty.bountyId,
      claimHash: receipt.claimHash,
      rejectionMarker: "303field",
      feeMicrocredits: 1_000_000,
    }),
    buildRefundBountyTransaction({
      bountyId: bounty.bountyId,
      amount: "700",
      refundMarker: "304field",
      feeMicrocredits: 1_000_000,
    }),
  ];

  assert.deepEqual(previews.map((preview) => preview.functionName), [
    "fund_bounty",
    "lock_reward",
    "request_disclosure",
    "attest_encrypted_details",
    "mark_patched",
    "release_reward",
    "reject_claim",
    "refund_bounty",
  ]);
  assert.deepEqual(previews[1].inputs, [
    "100field",
    "200field",
    address,
    "200u64",
    "305field",
  ]);
  assert.deepEqual(previews[2].inputs, ["100field", "200field", "306field"]);
  assert.deepEqual(previews[3].inputs, [
    "100field",
    "200field",
    "301field",
    "307field",
  ]);
  assert.deepEqual(previews[4].inputs, ["100field", "200field", "308field"]);
  assert.deepEqual(previews[5].inputs, [
    "100field",
    "200field",
    address,
    "200u64",
    "302field",
  ]);
  assertNoPrivateFields(previews);
});

test("Escrow transaction builders reject legacy receipts and malformed public inputs", () => {
  assert.throws(
    () => buildLockRewardTransaction({
      bounty,
      receipt: { ...receipt, protocolVersion: 1 },
      whitehatAddress: address,
      lockMarker: "305field",
      feeMicrocredits: 1_000_000,
    }),
    /protocol-v2/,
  );
  assert.throws(
    () => buildLockRewardTransaction({
      bounty,
      receipt: { ...receipt, severity: "Low" },
      whitehatAddress: address,
      lockMarker: "305field",
      feeMicrocredits: 1_000_000,
    }),
    /Low severity Claims are not eligible/,
  );
  assert.throws(
    () => buildFundBountyTransaction({
      bountyId: bounty.bountyId,
      amount: "0",
      fundingMarker: "300field",
      feeMicrocredits: 1_000_000,
    }),
    /positive u64/,
  );
  assert.throws(
    () => buildAttestEncryptedDetailsTransaction({
      bountyId: bounty.bountyId,
      claimHash: receipt.claimHash,
      packageHash: "0field",
      shareMarker: "307field",
      feeMicrocredits: 1_000_000,
    }),
    /non-zero Aleo field/,
  );
});

test("deployed Escrow capability requires matching Program source and current edition", async () => {
  const upgradedSource = readFileSync("leo/bug_proof/build/main.aleo", "utf8");
  const legacySource =
    "program zkbugbounty_7f3c92.aleo;\nmapping bounties: field => field;\nfunction create_bounty:\n";
  const fetchCapabilityEvidence = (source: string, edition: number) =>
    async (input: string | URL | Request) => String(input).endsWith("/latest_edition")
      ? new Response(String(edition))
      : Response.json(source);

  const available = await fetchRewardEscrowCapability(
    fetchCapabilityEvidence(upgradedSource, 1),
  );
  const notUpgraded = await fetchRewardEscrowCapability(
    fetchCapabilityEvidence(legacySource, 0),
  );
  const inconsistentEdition = await fetchRewardEscrowCapability(
    fetchCapabilityEvidence(upgradedSource, 0),
  );
  const incompatibleSignature = upgradedSource.replace(
    "function lock_reward:\n    input r0 as field.public;\n    input r1 as field.public;\n    input r2 as address.public;\n    input r3 as u64.public;\n    input r4 as field.public;",
    "function lock_reward:\n    input r0 as field.public;\n    input r1 as field.public;\n    input r2 as address.public;\n    input r3 as u64.public;\n    input r4 as u64.public;",
  );
  const incompatibleMapping = upgradedSource.replace(
    "mapping escrow_operation_markers:\n    key as field.public;\n    value as boolean.public;",
    "mapping escrow_operation_markers:\n    key as field.public;\n    value as u64.public;",
  );
  assert.notEqual(incompatibleSignature, upgradedSource);
  assert.notEqual(incompatibleMapping, upgradedSource);
  const signatureMismatch = await fetchRewardEscrowCapability(
    fetchCapabilityEvidence(incompatibleSignature, 1),
  );
  const mappingMismatch = await fetchRewardEscrowCapability(
    fetchCapabilityEvidence(incompatibleMapping, 1),
  );
  const unavailable = await fetchRewardEscrowCapability(
    async () => new Response(null, { status: 503 }),
  );

  assert.equal(available.status, "Available");
  assert.equal(available.currentEdition, 1);
  assert.equal(available.walletRequestEnabled, true);
  assert.equal(notUpgraded.status, "ProgramUpgradeRequired");
  assert.equal(notUpgraded.currentEdition, 0);
  assert.equal(notUpgraded.walletRequestEnabled, false);
  assert.equal(inconsistentEdition.status, "ConfigurationError");
  assert.equal(inconsistentEdition.walletRequestEnabled, false);
  assert.equal(signatureMismatch.status, "ConfigurationError");
  assert.equal(signatureMismatch.walletRequestEnabled, false);
  assert.equal(mappingMismatch.status, "ConfigurationError");
  assert.equal(mappingMismatch.walletRequestEnabled, false);
  assert.equal(unavailable.status, "EndpointUnavailable");
  assert.equal(unavailable.walletRequestEnabled, false);
});
test("Wallet protocol submission verifies live capability before opening a request", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const workspace = readFileSync("components/on-chain-triage-workspace.tsx", "utf8");
  const publicReceipt = readFileSync(
    "app/public-claims/[registryKey]/page.tsx",
    "utf8",
  );
  const start = provider.indexOf("async function submitProtocolTransaction");
  const end = provider.indexOf("async function refreshSubmission", start);
  const boundary = provider.slice(start, end);

  assert.match(boundary, /fetch\("\/api\/aleo\/escrow"/);
  assert.match(boundary, /status !== "Available"/);
  assert.match(boundary, /walletRequestEnabled !== true/);
  assert.ok(boundary.indexOf("/api/aleo/escrow") < boundary.indexOf("requestTransaction"));
  assert.equal(boundary.includes("localStorage"), false);
  assert.equal(boundary.includes("console."), false);
  assert.match(workspace, /claim_reporters/);
  assert.match(workspace, /rewardForSeverity/);
  assert.match(workspace, /\/api\/aleo\/network/);
  assert.match(workspace, /currentHeight === null/);
  assert.match(
    workspace,
    /currentHeight > bountyBundle\.bounty\.disclosureDeadline/,
  );
  assert.match(workspace, /payoutLocked/);
  assert.equal(workspace.includes("setRecipient"), false);
  assert.match(publicReceipt, /\/api\/aleo\/triage\//);
  assert.match(publicReceipt, /Program Upgrade Required/);
  assert.doesNotMatch(publicReceipt, /window\.localStorage|localStorage\.(?:getItem|setItem)/);
});
