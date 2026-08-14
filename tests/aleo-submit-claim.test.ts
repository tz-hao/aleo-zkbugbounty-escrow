import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildTransientSubmitClaimInputs,
  deriveReporterSecretField,
  SUBMIT_CLAIM_ABI_INPUTS,
  SUBMIT_CLAIM_WALLET_BOUNDARY,
  type TransientSubmitClaimRequest,
} from "../lib/aleo-submit-claim.ts";
import type { OnChainBountyState } from "../lib/models.ts";

const bounty: OnChainBountyState = {
  bountyId: "257640041950318553814753415615134947371field",
  owner: "aleo1hxrwn37uvt8jm5cks6wvxk44vx6vcgtmvwcsygqamuq6gr4ywuxs000q0w",
  scopeHash: "165263616045655158386888829934414575403field",
  ruleId: "vault-accounting-safety",
  rewards: { critical: "1000000", high: "500000", medium: "200000", low: "100000" },
  disclosureDeadline: 18_145_243,
  status: "Active",
  source: "AleoTestnet",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
  mapping: "bounties",
};

function request(overrides: Partial<TransientSubmitClaimRequest> = {}): TransientSubmitClaimRequest {
  return {
    bounty,
    latestBlockHeight: 18_045_285,
    feeMicrocredits: 5_000_000,
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
      reporterSecretField: "123456field",
    },
    ...overrides,
  };
}

test("submit_claim wallet boundary follows the deployed 16-input ABI", () => {
  const inputs = buildTransientSubmitClaimInputs(request());

  assert.equal(SUBMIT_CLAIM_WALLET_BOUNDARY.programId, "zkbugbounty_7f3c92.aleo");
  assert.equal(SUBMIT_CLAIM_WALLET_BOUNDARY.walletChainId, "testnetbeta");
  assert.equal(SUBMIT_CLAIM_WALLET_BOUNDARY.functionName, "submit_claim");
  assert.equal(inputs.length, 16);
  assert.deepEqual(inputs, [
    bounty.bountyId,
    bounty.scopeHash,
    "1field",
    "100u64",
    "100u64",
    "80u64",
    "20u64",
    "50u64",
    "40u64",
    "20u64",
    "90u64",
    "30u64",
    "0u64",
    "35u64",
    "10u64",
    "123456field",
  ]);
  assert.deepEqual(
    SUBMIT_CLAIM_ABI_INPUTS.slice(0, 3).map((input) => input.mode),
    ["public", "public", "public"],
  );
  assert.equal(SUBMIT_CLAIM_ABI_INPUTS.slice(3).every((input) => input.mode === "private"), true);
});

test("submit_claim rejects non-canonical, inactive, expired, and malformed inputs", () => {
  assert.throws(
    () => buildTransientSubmitClaimInputs(request({ bounty: { ...bounty, source: "DemoLocal" as never } })),
    /canonical Aleo Testnet bounty/,
  );
  assert.throws(
    () => buildTransientSubmitClaimInputs(request({ bounty: { ...bounty, status: "Paused" } })),
    /active bounty/,
  );
  assert.throws(
    () => buildTransientSubmitClaimInputs(request({ latestBlockHeight: bounty.disclosureDeadline + 1 })),
    /deadline/,
  );
  assert.throws(
    () => buildTransientSubmitClaimInputs(request({ witness: { ...request().witness, hiddenDeltaClaims: "-1" } })),
    /unsigned integer/,
  );
});

test("reporter secret is deterministically derived to a field without persistence", async () => {
  const secret = "test-only-secret";
  const expectedHex = createHash("sha256")
    .update(`reporter-secret:${secret}`, "utf8")
    .digest("hex")
    .slice(0, 62);
  const field = await deriveReporterSecretField(secret);

  assert.equal(field, `${BigInt(`0x${expectedHex}`).toString()}field`);
  assert.equal(field.includes(secret), false);
});

test("wallet-signed submit_claim keeps only public submission state", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const page = readFileSync("app/submit-proof/page.tsx", "utf8");
  const publicBounty = readFileSync("components/public-bounty-view.tsx", "utf8");
  const publicState = provider.match(/export type WalletClaimSubmission = \{([\s\S]*?)\n\};/)?.[1] ?? "";

  assert.match(provider, /Network\.TESTNET/);
  assert.match(provider, /SUBMIT_CLAIM_FUNCTION/);
  assert.match(provider, /inputs\.fill\(""\)/);
  assert.match(provider, /request\.witness\[key\] = ""/);
  assert.match(page, /\/api\/aleo\/bounties\//);
  assert.match(page, /\/api\/aleo\/network/);
  assert.match(page, /submitWalletClaim/);
  assert.match(publicBounty, /\/submit-proof\?bountyId=/);
  assert.equal(provider.includes("console.log"), false);
  assert.equal(page.includes("console.log"), false);
  assert.equal(page.includes("localStorage"), false);
  for (const privateKey of ["witness", "hiddenDelta", "reporterSecret", "privateCallSequence", "privateStateValues"]) {
    assert.equal(publicState.includes(privateKey), false, `${privateKey} leaked into public wallet state`);
  }
});
