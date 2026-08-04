import assert from "node:assert/strict";
import test from "node:test";

import { handleAleoBountyEscrowLookup } from "../app/api/aleo/escrow/[bountyId]/route.ts";
import { handleAleoClaimTriageLookup } from "../app/api/aleo/triage/[claimHash]/route.ts";
import type { AleoBountyRegistryConfig } from "../lib/aleo-bounty-registry.ts";
import {
  fetchOnChainBountyEscrow,
  fetchOnChainBountyClaimCount,
  fetchOnChainBountyProtocolVersion,
  fetchOnChainClaimPayout,
  fetchOnChainClaimReporter,
  fetchOnChainClaimTriage,
  parseOnChainBountyEscrow,
  parseOnChainClaimPayout,
  parseOnChainClaimTriage,
} from "../lib/aleo-escrow-registry.ts";
import {
  REWARD_ESCROW_CAPABILITY,
  type RewardEscrowCapability,
} from "../lib/aleo-reward-escrow.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";

const config: AleoBountyRegistryConfig = {
  endpoint: "https://api.explorer.provable.com/v1",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
};
const bountyId = "100field";
const claimHash = "200field";
const address = `aleo1${"a".repeat(58)}`;

const escrowRaw = `{
  owner_address: ${address},
  total_funded: 1000u64,
  available_balance: 700u64,
  locked_amount: 200u64,
  paid_amount: 100u64,
  refunded_amount: 0u64,
  status: 1u8,
  last_funding_height: 18000000u32,
  last_funding_marker: 300field,
  last_refund_marker: 0field
}`;

const payoutRaw = `{
  claim_hash: ${claimHash},
  bounty_id: ${bountyId},
  whitehat_address: ${address},
  reward_amount: 200u64,
  status: 1u8,
  locked_height: 18000001u32,
  paid_height: 0u32,
  release_marker: 0field
}`;

const rejectedPayoutRaw = `{
  claim_hash: ${claimHash},
  bounty_id: ${bountyId},
  whitehat_address: ${address},
  reward_amount: 0u64,
  status: 3u8,
  locked_height: 0u32,
  paid_height: 0u32,
  release_marker: 305field
}`;
const triageRaw = `{
  claim_hash: ${claimHash},
  bounty_id: ${bountyId},
  status: 3u8,
  package_hash: 400field,
  updated_height: 18000002u32
}`;

const availableCapability: RewardEscrowCapability = {
  ...REWARD_ESCROW_CAPABILITY,
  status: "Available",
  transactionBuilderEnabled: true,
  walletRequestEnabled: true,
  presentFunctions: [...REWARD_ESCROW_CAPABILITY.missingFunctions],
  missingFunctions: [],
  presentMappings: [...REWARD_ESCROW_CAPABILITY.missingMappings],
  missingMappings: [],
};

test("strict public Escrow, Payout, and Triage parsers expose only mapped fields", () => {
  const escrow = parseOnChainBountyEscrow(escrowRaw, bountyId, config);
  const payout = parseOnChainClaimPayout(payoutRaw, claimHash, config);
  const triage = parseOnChainClaimTriage(triageRaw, claimHash, config);

  assert.equal(escrow.availableBalance, "700");
  assert.equal(escrow.lastRefundMarker, null);
  assert.equal(payout.status, "RewardLocked");
  assert.equal(payout.paidHeight, null);
  const rejectedPayout = parseOnChainClaimPayout(rejectedPayoutRaw, claimHash, config);
  assert.equal(rejectedPayout.status, "Rejected");
  assert.equal(rejectedPayout.rewardAmount, "0");
  assert.equal(triage.status, "EncryptedDetailsShared");
  assert.equal(triage.packageHash, "400field");
  assertNoPrivateFields({ escrow, payout, triage });
});

test("Escrow registry parsers reject key mismatch, unknown status, and private-shaped fields", () => {
  assert.throws(
    () => parseOnChainClaimPayout(payoutRaw, "201field", config),
    /key or Bounty ID/,
  );
  assert.throws(
    () => parseOnChainClaimTriage(triageRaw.replace("3u8", "9u8"), claimHash, config),
    /Unsupported triage status/,
  );
  assert.throws(
    () => parseOnChainBountyEscrow(
      escrowRaw.replace("last_refund_marker: 0field", "reporter_secret: 9field"),
      bountyId,
      config,
    ),
    /unexpected field/,
  );
});

test("Escrow registry fetches only canonical public mapping URLs", async () => {
  const requested: string[] = [];
  const responses = [escrowRaw, payoutRaw, triageRaw, address, "2u8", "1u64"];
  const fetcher = async (input: string | URL | Request) => {
    requested.push(String(input));
    return new Response(responses.shift(), { status: 200 });
  };
  await fetchOnChainBountyEscrow(bountyId, config, fetcher);
  await fetchOnChainClaimPayout(claimHash, config, fetcher);
  await fetchOnChainClaimTriage(claimHash, config, fetcher);
  assert.equal(await fetchOnChainClaimReporter(claimHash, config, fetcher), address);
  assert.equal(await fetchOnChainBountyProtocolVersion(bountyId, config, fetcher), 2);
  assert.equal(await fetchOnChainBountyClaimCount(bountyId, config, fetcher), "1");

  assert.match(requested[0], /mapping\/bounty_escrows\/100field$/);
  assert.match(requested[1], /mapping\/claim_payouts\/200field$/);
  assert.match(requested[2], /mapping\/claim_triage_states\/200field$/);
  assert.match(requested[3], /mapping\/claim_reporters\/200field$/);
  assert.match(requested[4], /mapping\/bounty_protocol_versions\/100field$/);
  assert.match(requested[5], /mapping\/bounty_claim_counts\/100field$/);
});

test("Escrow APIs keep Program Upgrade Required distinct from a missing mapping", async () => {
  const blockedEscrow = await handleAleoBountyEscrowLookup(bountyId, {
    capability: REWARD_ESCROW_CAPABILITY,
    config,
  });
  const blockedTriage = await handleAleoClaimTriageLookup(claimHash, {
    capability: REWARD_ESCROW_CAPABILITY,
    config,
  });
  assert.equal(blockedEscrow.status, 409);
  assert.equal(blockedTriage.status, 409);
  assert.equal("escrow" in blockedEscrow.body, false);
  assert.equal("triage" in blockedTriage.body, false);
});

test("available Escrow APIs return mapping data without Mock fallback", async () => {
  const escrowResponses = [escrowRaw, "2u8", "1u64"];
  const escrowResult = await handleAleoBountyEscrowLookup(bountyId, {
    capability: availableCapability,
    config,
    fetcher: async () => new Response(escrowResponses.shift(), { status: 200 }),
  });
  const triageResponses = [payoutRaw, triageRaw, address];
  const triageResult = await handleAleoClaimTriageLookup(claimHash, {
    capability: availableCapability,
    config,
    fetcher: async () => new Response(triageResponses.shift(), { status: 200 }),
  });
  assert.equal(escrowResult.status, 200);
  assert.equal(triageResult.status, 200);
  assert.equal(
    "reporterAddress" in triageResult.body ? triageResult.body.reporterAddress : null,
    address,
  );
  assert.equal(
    "protocolVersion" in escrowResult.body ? escrowResult.body.protocolVersion : null,
    2,
  );
  assertNoPrivateFields({ escrowResult, triageResult });
});

test("Escrow API rejects protocol-v1 Bounties even when capability is available", async () => {
  const responses = [escrowRaw, "1u8", "0u64"];
  const result = await handleAleoBountyEscrowLookup(bountyId, {
    capability: availableCapability,
    config,
    fetcher: async () => new Response(responses.shift(), { status: 200 }),
  });

  assert.equal(result.status, 404);
  assert.equal("escrow" in result.body, false);
  assert.match("error" in result.body ? result.body.error : "", /Protocol-v2/);
});
test("Claim reporter mapping remains readable before reward lock", async () => {
  const result = await handleAleoClaimTriageLookup(claimHash, {
    capability: availableCapability,
    config,
    fetcher: async (input) =>
      String(input).includes("/mapping/claim_reporters/")
        ? new Response(address, { status: 200 })
        : new Response(null, { status: 404 }),
  });

  assert.equal(result.status, 200);
  assert.equal("payout" in result.body ? result.body.payout : undefined, null);
  assert.equal("triage" in result.body ? result.body.triage : undefined, null);
  assert.equal(
    "reporterAddress" in result.body ? result.body.reporterAddress : undefined,
    address,
  );
});
