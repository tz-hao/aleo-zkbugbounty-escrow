import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildTransientSubmitClaimV2Inputs,
  SUBMIT_CLAIM_V2_ABI_INPUTS,
  SUBMIT_CLAIM_V2_FUNCTION,
  SUBMIT_CLAIM_V2_WALLET_BOUNDARY,
  type TransientSubmitClaimV2Request,
} from "../lib/aleo-submit-claim-v2.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import type { OnChainBountyState } from "../lib/models.ts";

const bounty: OnChainBountyState = {
  bountyId: "700field",
  owner: `aleo1${"a".repeat(58)}`,
  scopeHash: "701field",
  ruleId: "vault-accounting-safety",
  rewards: { critical: "300", high: "200", medium: "100", low: "0" },
  disclosureDeadline: 20_000_000,
  status: "Active",
  source: "AleoTestnet",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
  mapping: "bounties",
};

function request(): TransientSubmitClaimV2Request {
  return {
    bounty,
    latestBlockHeight: 19_000_000,
    feeMicrocredits: 1_000_000,
    witness: {
      vaultBalanceBefore: "100",
      totalDepositsBefore: "100",
      totalClaimsBefore: "80",
      reservedRewardsBefore: "20",
      withdrawLimitBefore: "50",
      userBalanceBefore: "40",
      requestedWithdrawBefore: "20",
      hiddenDeltaBalance: "90",
      hiddenDeltaClaims: "30",
      hiddenDeltaReservedRewards: "0",
      hiddenDeltaWithdrawAmount: "35",
      hiddenDeltaUserBalance: "10",
      reporterSecretField: "702field",
    },
  };
}

test("submit_claim_v2 wallet builder preserves the deployed 16-input ABI", () => {
  const inputs = buildTransientSubmitClaimV2Inputs(request());

  assert.equal(SUBMIT_CLAIM_V2_FUNCTION, "submit_claim_v2");
  assert.equal(SUBMIT_CLAIM_V2_WALLET_BOUNDARY.programId, "zkbugbounty_7f3c92.aleo");
  assert.equal(SUBMIT_CLAIM_V2_WALLET_BOUNDARY.protocolVersion, 2);
  assert.equal(inputs.length, 16);
  assert.deepEqual(inputs.slice(0, 3), ["700field", "701field", "1field"]);
  assert.equal(SUBMIT_CLAIM_V2_ABI_INPUTS.slice(0, 3).every((input) => input.mode === "public"), true);
  assert.equal(SUBMIT_CLAIM_V2_ABI_INPUTS.slice(3).every((input) => input.mode === "private"), true);
  assertNoPrivateFields(SUBMIT_CLAIM_V2_WALLET_BOUNDARY);
});

test("real submit page and Wallet adapter require protocol-v2 capability before submit_claim_v2", async () => {
  const { readFile } = await import("node:fs/promises");
  const [page, provider, index] = await Promise.all([
    readFile("app/submit-proof/page.tsx", "utf8"),
    readFile("components/aleo-wallet-provider.tsx", "utf8"),
    readFile("lib/aleo-public-index.ts", "utf8"),
  ]);

  assert.match(page, /escrowPayload\?\.protocolVersion !== 2/);
  assert.match(page, /submitWalletClaimV2/);
  assert.match(page, /submit_claim_v2/);
  assert.equal(page.includes("/api/aleo/prove"), false);
  assert.match(provider, /submitWalletClaimV2/);
  assert.match(provider, /bountyPayload\?\.protocolVersion !== 2/);
  assert.match(provider, /SUBMIT_CLAIM_V2_FUNCTION/);
  assert.match(index, /"submit_claim_v2"/);
});

test("real submit page prevents a Bounty owner from self-reporting through the Whitehat flow", async () => {
  const { readFile } = await import("node:fs/promises");
  const page = await readFile("app/submit-proof/page.tsx", "utf8");

  assert.match(page, /const walletIsBountyOwner/);
  assert.match(page, /wallet\.address!\.toLowerCase\(\) === onChainBounty!\.owner\.toLowerCase\(\)/);
  assert.match(page, /walletIsBountyOwner\) \{/);
  assert.match(page, /walletIsBountyOwner \|\|/);
  assert.match(page, /claim_reporters/);
});