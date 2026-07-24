import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectRewardEscrowAbi,
  REWARD_ESCROW_CAPABILITY,
  REWARD_ESCROW_FUNCTIONS,
  REWARD_ESCROW_MAPPINGS,
  REWARD_ESCROW_UPGRADE_PLAN,
} from "../lib/aleo-reward-escrow.ts";

const OWNER = "aleo1owner";
const WHITEHAT = "aleo1whitehat";
const BOUNTY_ID = "100field";
const CLAIM_HASH = "200field";

type AbiFunction = {
  name: string;
  inputs: Array<{ name: string; mode: string; ty: unknown }>;
  outputs: Array<{ ty: unknown; mode: string }>;
};

type SimBounty = {
  owner: string;
  status: 1 | 2 | 3;
  deadline: number;
};

type SimClaim = {
  bountyId: string;
  proofStatus: 1 | 2 | 3;
  reporter: string;
};

type SimEscrow = {
  owner: string;
  available: number;
  locked: number;
  paid: number;
  refunded: number;
  claimCount: number;
  payouts: Map<string, { whitehat: string; reward: number; status: 1 | 2 }>;
};

function readAbi() {
  return JSON.parse(readFileSync("leo/bug_proof/build/abi.json", "utf8")) as {
    functions: AbiFunction[];
  };
}

function findFunction(name: string) {
  const fn = readAbi().functions.find((entry) => entry.name === name);
  assert.ok(fn, `${name} must exist in local upgrade ABI`);
  return fn;
}

function primitiveName(value: unknown): string {
  const json = JSON.stringify(value);
  if (json.includes('"Field"')) return "field";
  if (json.includes('"Address"')) return "address";
  if (json.includes('"U64"')) return "u64";
  if (json.includes('"U32"')) return "u32";
  if (json.includes('"U8"')) return "u8";
  return json;
}

function functionInputs(name: string) {
  return findFunction(name).inputs.map((input) => ({
    name: input.name,
    mode: input.mode,
    type: primitiveName(input.ty),
  }));
}

function fundedEscrow(): SimEscrow {
  return {
    owner: OWNER,
    available: 1_000,
    locked: 0,
    paid: 0,
    refunded: 0,
    claimCount: 1,
    payouts: new Map(),
  };
}

function fundBounty(bounty: SimBounty, actor: string, escrow: SimEscrow | null, amount: number) {
  assert.equal(actor, bounty.owner);
  assert.ok(amount > 0);
  assert.ok(bounty.status === 1 || bounty.status === 2);
  const current = escrow ?? {
    owner: actor,
    available: 0,
    locked: 0,
    paid: 0,
    refunded: 0,
    claimCount: 0,
    payouts: new Map<string, { whitehat: string; reward: number; status: 1 | 2 }>(),
  };
  current.available += amount;
  return current;
}

function lockReward(
  bounty: SimBounty,
  claim: SimClaim,
  actor: string,
  escrow: SimEscrow,
  whitehat: string,
  reward: number,
) {
  assert.equal(actor, bounty.owner);
  assert.equal(claim.bountyId, BOUNTY_ID);
  assert.equal(claim.proofStatus, 1);
  assert.equal(claim.reporter, whitehat);
  assert.ok(escrow.available >= reward);
  assert.equal(escrow.payouts.has(CLAIM_HASH), false);
  escrow.available -= reward;
  escrow.locked += reward;
  escrow.payouts.set(CLAIM_HASH, { whitehat, reward, status: 1 });
}

function releaseReward(
  bounty: SimBounty,
  claim: SimClaim,
  actor: string,
  escrow: SimEscrow,
  whitehat: string,
  reward: number,
) {
  assert.equal(actor, bounty.owner);
  assert.ok(bounty.status === 1 || bounty.status === 2 || bounty.status === 3);
  assert.equal(claim.proofStatus, 1);
  assert.equal(claim.reporter, whitehat);
  const payout = escrow.payouts.get(CLAIM_HASH);
  assert.ok(payout);
  assert.equal(payout.status, 1);
  assert.equal(payout.whitehat, whitehat);
  assert.equal(payout.reward, reward);
  assert.ok(escrow.locked >= reward);
  escrow.locked -= reward;
  escrow.paid += reward;
  payout.status = 2;
}

function refundBounty(bounty: SimBounty, actor: string, escrow: SimEscrow, amount: number, height: number) {
  assert.equal(actor, bounty.owner);
  assert.equal(bounty.status, 3);
  assert.ok(height > bounty.deadline);
  assert.equal(escrow.locked, 0);
  assert.equal(escrow.claimCount, 0);
  assert.ok(escrow.available >= amount);
  escrow.available -= amount;
  escrow.refunded += amount;
}

test("local upgrade ABI exposes reward escrow entries while deployed capability stays disabled", () => {
  const inspection = inspectRewardEscrowAbi(readAbi());

  assert.equal(inspection.available, true);
  assert.deepEqual(inspection.presentFunctions, [...REWARD_ESCROW_FUNCTIONS]);
  assert.deepEqual(inspection.missingFunctions, []);
  assert.deepEqual(inspection.presentMappings, [...REWARD_ESCROW_MAPPINGS]);
  assert.deepEqual(inspection.missingMappings, []);
  assert.equal(REWARD_ESCROW_CAPABILITY.status, "ProgramUpgradeRequired");
  assert.equal(REWARD_ESCROW_CAPABILITY.transactionBuilderEnabled, false);
  assert.equal(REWARD_ESCROW_CAPABILITY.walletRequestEnabled, false);
  assert.equal(REWARD_ESCROW_CAPABILITY.demoFallbackAllowed, false);
});

test("reward escrow upgrade keeps existing public entry signatures stable", () => {
  assert.deepEqual(functionInputs("fund_bounty"), [
    { name: "bounty_id", mode: "Public", type: "field" },
    { name: "amount", mode: "Public", type: "u64" },
    { name: "funding_marker", mode: "Public", type: "field" },
  ]);
  assert.deepEqual(functionInputs("lock_reward"), [
    { name: "bounty_id", mode: "Public", type: "field" },
    { name: "claim_hash", mode: "Public", type: "field" },
    { name: "whitehat_address", mode: "Public", type: "address" },
    { name: "reward_amount", mode: "Public", type: "u64" },
  ]);
  assert.deepEqual(functionInputs("release_reward"), [
    { name: "bounty_id", mode: "Public", type: "field" },
    { name: "claim_hash", mode: "Public", type: "field" },
    { name: "whitehat_address", mode: "Public", type: "address" },
    { name: "reward_amount", mode: "Public", type: "u64" },
    { name: "release_marker", mode: "Public", type: "field" },
  ]);
  assert.deepEqual(functionInputs("refund_bounty"), [
    { name: "bounty_id", mode: "Public", type: "field" },
    { name: "amount", mode: "Public", type: "u64" },
    { name: "refund_marker", mode: "Public", type: "field" },
  ]);

  assert.deepEqual(REWARD_ESCROW_UPGRADE_PLAN.preservedEntryFunctions, [
    "prove_vault_invariant_break",
    "submit_claim",
    "create_bounty",
    "pause_bounty",
    "close_bounty",
  ]);
});

test("Leo source enforces real Credits escrow and payout guards", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");
  const fund = source.slice(source.indexOf("fn fund_bounty"), source.indexOf("fn lock_reward"));
  const lock = source.slice(source.indexOf("fn lock_reward"), source.indexOf("fn release_reward"));
  const release = source.slice(source.indexOf("fn release_reward"), source.indexOf("fn refund_bounty"));
  const refund = source.slice(source.indexOf("fn refund_bounty"), source.indexOf("@admin"));

  assert.match(source, /import credits\.aleo;/);
  assert.match(source, /mapping bounty_escrows: field => BountyEscrowState;/);
  assert.match(source, /mapping claim_payouts: field => ClaimPayoutState;/);
  assert.match(source, /mapping bounty_claim_counts: field => u64;/);
  assert.match(source, /mapping claim_reporters: field => address;/);
  assert.match(source, /Mapping::set\(claim_reporters, claim_hash, signer\);/);
  assert.match(source, /Mapping::set\(bounty_claim_counts, bounty_id, 0u64\);/);

  assert.match(fund, /credits\.aleo::transfer_public_as_signer/);
  assert.match(fund, /assert_eq\(bounty\.owner_address, signer\);/);
  assert.match(fund, /assert\(bounty\.status == 1u8 \|\| bounty\.status == 2u8\);/);

  assert.match(lock, /assert_eq\(receipt\.proof_status, 1u8\);/);
  assert.match(lock, /Mapping::contains\(claim_reporters, claim_hash\)/);
  assert.match(lock, /assert_eq\(reporter, whitehat_address\);/);
  assert.match(lock, /assert\(escrow\.available_balance >= reward_amount\);/);
  assert.match(lock, /assert\(!Mapping::contains\(claim_payouts, claim_hash\)\);/);

  assert.match(release, /credits\.aleo::transfer_public/);
  assert.match(release, /assert_eq\(payout\.status, 1u8\);/);
  assert.match(release, /assert_eq\(payout\.whitehat_address, whitehat_address\);/);
  assert.match(release, /assert\(escrow\.locked_amount >= reward_amount\);/);
  assert.ok(release.indexOf("transfer.run();") > release.indexOf("assert(escrow.locked_amount >= reward_amount);"));

  assert.match(refund, /assert_eq\(bounty\.status, 3u8\);/);
  assert.match(refund, /assert\(block\.height > bounty\.disclosure_deadline\);/);
  assert.match(refund, /assert\(Mapping::contains\(bounty_claim_counts, bounty_id\)\);/);
  assert.match(refund, /assert_eq\(escrow\.locked_amount, 0u64\);/);
  assert.match(refund, /assert_eq\(claim_count, 0u64\);/);
  assert.match(refund, /assert\(escrow\.available_balance >= amount\);/);
});

test("escrow state model accepts valid fund, lock, and release flow", () => {
  const bounty: SimBounty = { owner: OWNER, status: 1, deadline: 100 };
  const claim: SimClaim = { bountyId: BOUNTY_ID, proofStatus: 1, reporter: WHITEHAT };
  const escrow = fundBounty(bounty, OWNER, null, 1_000);

  lockReward(bounty, claim, OWNER, escrow, WHITEHAT, 300);
  releaseReward(bounty, claim, OWNER, escrow, WHITEHAT, 300);

  assert.equal(escrow.available, 700);
  assert.equal(escrow.locked, 0);
  assert.equal(escrow.paid, 300);
  assert.equal(escrow.payouts.get(CLAIM_HASH)?.status, 2);
});

test("escrow state model rejects invalid actor, unverified claim, overdraft, and duplicate payout", () => {
  const bounty: SimBounty = { owner: OWNER, status: 1, deadline: 100 };
  const verifiedClaim: SimClaim = { bountyId: BOUNTY_ID, proofStatus: 1, reporter: WHITEHAT };
  const rejectedClaim: SimClaim = { bountyId: BOUNTY_ID, proofStatus: 3, reporter: WHITEHAT };
  const escrow = fundedEscrow();

  assert.throws(() => fundBounty(bounty, "aleo1attacker", null, 1));
  assert.throws(() => lockReward(bounty, rejectedClaim, OWNER, escrow, WHITEHAT, 100));
  assert.throws(() => lockReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 2_000));

  lockReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 100);
  assert.throws(() => lockReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 100));
  releaseReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 100);
  assert.throws(() => releaseReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 100));
});

test("refund model blocks malicious owner refund after any valid claim", () => {
  const closed: SimBounty = { owner: OWNER, status: 3, deadline: 100 };
  const noClaims = fundedEscrow();
  noClaims.claimCount = 0;
  refundBounty(closed, OWNER, noClaims, 200, 101);
  assert.equal(noClaims.refunded, 200);

  const withClaim = fundedEscrow();
  assert.throws(() => refundBounty(closed, OWNER, withClaim, 200, 101));
  const withLocked = fundedEscrow();
  withLocked.claimCount = 0;
  withLocked.locked = 100;
  assert.throws(() => refundBounty(closed, OWNER, withLocked, 200, 101));
  assert.throws(() => refundBounty({ ...closed, status: 1 }, OWNER, noClaims, 1, 101));
  assert.throws(() => refundBounty(closed, OWNER, noClaims, 1, 100));
});

test("escrow API remains disabled until the upgraded program is manually broadcast", () => {
  const route = readFileSync("app/api/aleo/escrow/route.ts", "utf8");
  const status = readFileSync("components/reward-escrow-status.tsx", "utf8");

  assert.match(route, /status: 409/);
  assert.equal(route.includes("request.json"), false);
  assert.equal(route.includes("requestTransaction"), false);
  assert.match(status, /Program Upgrade Required/);
  assert.match(status, /Wallet Actions Disabled/);
  assert.match(status, /Confirmed Transaction/);
  assert.match(status, /Mapping Verified/);
});
