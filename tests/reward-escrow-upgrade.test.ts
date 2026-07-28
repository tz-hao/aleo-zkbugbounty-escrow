import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  inspectRewardEscrowAbi,
  RESPONSIBLE_DISCLOSURE_FUNCTIONS,
  REWARD_ESCROW_CAPABILITY,
  REWARD_ESCROW_FUNCTIONS,
  REWARD_ESCROW_MAPPINGS,
  REWARD_ESCROW_UPGRADE_PLAN,
} from "../lib/aleo-reward-escrow.ts";
import { readCanonicalLeoSourceAbi } from "./helpers/leo-source-abi.ts";

const OWNER = "aleo1owner";
const WHITEHAT = "aleo1whitehat";
const ARBITER = "aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6";
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
  severity: 1 | 2 | 3;
};

type SimEscrow = {
  owner: string;
  status: 1 | 3;
  available: number;
  locked: number;
  paid: number;
  refunded: number;
  claimCount: number;
  payouts: Map<string, {
    whitehat: string;
    reward: number;
    status: 1 | 2 | 3;
    triageStatus: 1 | 2 | 3 | 4 | 5 | 6;
    packageHash: string | null;
  }>;
  markers: Set<string>;
};

function readAbi() {
  return readCanonicalLeoSourceAbi() as {
    functions: AbiFunction[];
    mappings: Array<{ name: string }>;
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
    status: 1,
    available: 1_000,
    locked: 0,
    paid: 0,
    refunded: 0,
    claimCount: 1,
    payouts: new Map(),
    markers: new Set(),
  };
}

function fundBounty(bounty: SimBounty, actor: string, escrow: SimEscrow | null, amount: number) {
  assert.equal(actor, bounty.owner);
  assert.ok(amount > 0);
  assert.ok(bounty.status === 1 || bounty.status === 2);
  const current = escrow ?? {
    owner: actor,
    status: 1 as const,
    available: 0,
    locked: 0,
    paid: 0,
    refunded: 0,
    claimCount: 0,
    payouts: new Map(),
    markers: new Set(),
  };
  assert.equal(current.status, 1);
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
  const expectedReward = claim.severity === 3 ? 300 : claim.severity === 2 ? 200 : 100;
  assert.equal(reward, expectedReward);
  assert.ok(escrow.available >= reward);
  assert.equal(escrow.payouts.has(CLAIM_HASH), false);
  escrow.available -= reward;
  escrow.locked += reward;
  escrow.payouts.set(CLAIM_HASH, {
    whitehat,
    reward,
    status: 1,
    triageStatus: 1,
    packageHash: null,
  });
}

function requestDisclosure(bounty: SimBounty, actor: string, escrow: SimEscrow) {
  assert.equal(actor, bounty.owner);
  const payout = escrow.payouts.get(CLAIM_HASH);
  assert.ok(payout);
  assert.equal(payout.status, 1);
  assert.equal(payout.triageStatus, 1);
  payout.triageStatus = 2;
}

function shareEncryptedDetails(claim: SimClaim, actor: string, escrow: SimEscrow, packageHash: string) {
  assert.equal(actor, claim.reporter);
  assert.notEqual(packageHash, "");
  const payout = escrow.payouts.get(CLAIM_HASH);
  assert.ok(payout);
  assert.equal(payout.triageStatus, 2);
  payout.triageStatus = 3;
  payout.packageHash = packageHash;
}

function markPatched(bounty: SimBounty, actor: string, escrow: SimEscrow) {
  assert.equal(actor, bounty.owner);
  const payout = escrow.payouts.get(CLAIM_HASH);
  assert.ok(payout);
  assert.equal(payout.triageStatus, 3);
  assert.ok(payout.packageHash);
  payout.triageStatus = 4;
}

function releaseReward(
  bounty: SimBounty,
  claim: SimClaim,
  actor: string,
  escrow: SimEscrow,
  whitehat: string,
  reward: number,
  marker = "release-1",
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
  assert.equal(payout.triageStatus, 4);
  assert.ok(escrow.locked >= reward);
  assert.equal(escrow.markers.has(marker), false);
  assert.ok(escrow.claimCount > 0);
  escrow.locked -= reward;
  escrow.paid += reward;
  payout.status = 2;
  payout.triageStatus = 5;
  escrow.claimCount -= 1;
  escrow.markers.add(marker);
}

function rejectClaim(
  claim: SimClaim,
  actor: string,
  escrow: SimEscrow,
  marker = "reject-1",
) {
  assert.equal(actor, ARBITER);
  const payout = escrow.payouts.get(CLAIM_HASH);
  assert.equal(escrow.markers.has(marker), false);
  assert.ok(escrow.claimCount > 0);
  if (payout) {
    assert.ok(payout.triageStatus === 1 || payout.triageStatus === 2);
    assert.equal(payout.whitehat, claim.reporter);
    assert.equal(payout.status, 1);
    escrow.locked -= payout.reward;
    escrow.available += payout.reward;
    payout.status = 3;
    payout.triageStatus = 6;
  } else {
    escrow.payouts.set(CLAIM_HASH, {
      whitehat: claim.reporter,
      reward: 0,
      status: 3,
      triageStatus: 6,
      packageHash: null,
    });
  }
  escrow.claimCount -= 1;
  escrow.markers.add(marker);
}

function refundBounty(
  bounty: SimBounty,
  actor: string,
  escrow: SimEscrow,
  amount: number,
  height: number,
  marker = "refund-1",
) {
  assert.equal(actor, bounty.owner);
  assert.equal(bounty.status, 3);
  assert.ok(height > bounty.deadline);
  assert.equal(escrow.locked, 0);
  assert.equal(escrow.claimCount, 0);
  assert.equal(escrow.status, 1);
  assert.equal(escrow.available, amount);
  assert.equal(escrow.markers.has(marker), false);
  escrow.available = 0;
  escrow.refunded += amount;
  escrow.status = 3;
  escrow.markers.add(marker);
}

test("local upgrade ABI exposes reward escrow entries while deployed capability stays disabled", () => {
  const inspection = inspectRewardEscrowAbi(readAbi());

  assert.equal(inspection.available, true);
  assert.deepEqual(inspection.presentFunctions, [
    ...REWARD_ESCROW_FUNCTIONS,
    ...RESPONSIBLE_DISCLOSURE_FUNCTIONS,
  ]);
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
    { name: "lock_marker", mode: "Public", type: "field" },
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
  assert.deepEqual(functionInputs("request_disclosure"), [
    { name: "bounty_id", mode: "Public", type: "field" },
    { name: "claim_hash", mode: "Public", type: "field" },
    { name: "request_marker", mode: "Public", type: "field" },
  ]);
  assert.deepEqual(functionInputs("attest_encrypted_details"), [
    { name: "bounty_id", mode: "Public", type: "field" },
    { name: "claim_hash", mode: "Public", type: "field" },
    { name: "package_hash", mode: "Public", type: "field" },
    { name: "share_marker", mode: "Public", type: "field" },
  ]);
  assert.deepEqual(functionInputs("mark_patched"), [
    { name: "bounty_id", mode: "Public", type: "field" },
    { name: "claim_hash", mode: "Public", type: "field" },
    { name: "patched_marker", mode: "Public", type: "field" },
  ]);
  assert.deepEqual(functionInputs("reject_claim"), [
    { name: "bounty_id", mode: "Public", type: "field" },
    { name: "claim_hash", mode: "Public", type: "field" },
    { name: "rejection_marker", mode: "Public", type: "field" },
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
  const lock = source.slice(source.indexOf("fn lock_reward"), source.indexOf("fn request_disclosure"));
  const request = source.slice(source.indexOf("fn request_disclosure"), source.indexOf("fn attest_encrypted_details"));
  const share = source.slice(source.indexOf("fn attest_encrypted_details"), source.indexOf("fn mark_patched"));
  const patch = source.slice(source.indexOf("fn mark_patched"), source.indexOf("fn release_reward"));
  const release = source.slice(source.indexOf("fn release_reward"), source.indexOf("fn reject_claim"));
  const reject = source.slice(source.indexOf("fn reject_claim"), source.indexOf("fn refund_bounty"));
  const refund = source.slice(source.indexOf("fn refund_bounty"), source.indexOf("@admin"));

  assert.match(source, /import credits\.aleo;/);
  assert.match(source, /mapping bounty_escrows: field => BountyEscrowState;/);
  assert.match(source, /mapping claim_payouts: field => ClaimPayoutState;/);
  assert.match(source, /mapping bounty_claim_counts: field => u64;/);
  assert.match(source, /mapping claim_reporters: field => address;/);
  assert.match(source, /mapping claim_triage_states: field => ClaimTriageState;/);
  assert.match(source, /mapping bounty_protocol_versions: field => u8;/);
  assert.match(source, /mapping escrow_operation_markers: field => bool;/);
  assert.match(source, /fn derive_operation_marker\(/);
  for (const domain of [201, 202, 203, 204, 205, 206, 207, 208]) {
    assert.match(source, new RegExp(`${domain}field`));
  }
  assert.equal(
    source.match(/Mapping::set\(escrow_operation_markers, operation_marker, true\);/g)?.length,
    8,
  );
  assert.match(source, /Mapping::set\(claim_reporters, claim_hash, signer\);/);
  assert.match(source, /Mapping::set\(bounty_claim_counts, bounty_id, 0u64\);/);
  assert.match(source, /Mapping::get_or_use\([\s\S]*bounty_protocol_versions,[\s\S]*1u8/);

  assert.match(fund, /credits\.aleo::transfer_public_as_signer/);
  assert.match(fund, /assert_eq\(bounty\.owner_address, signer\);/);
  assert.match(fund, /assert\(bounty\.status == 1u8 \|\| bounty\.status == 2u8\);/);
  assert.match(fund, /assert\(block\.height <= bounty\.disclosure_deadline\);/);
  assert.match(fund, /escrow_operation_markers/);

  assert.match(lock, /assert_eq\(receipt\.proof_status, 1u8\);/);
  assert.match(lock, /assert_eq\(receipt\.protocol_version, 2u8\);/);
  assert.match(lock, /assert_eq\(reward_amount, expected_reward\);/);
  assert.match(lock, /Mapping::contains\(claim_reporters, claim_hash\)/);
  assert.match(lock, /assert_eq\(reporter, whitehat_address\);/);
  assert.match(lock, /assert\(escrow\.available_balance >= reward_amount\);/);
  assert.match(lock, /assert\(!Mapping::contains\(claim_payouts, claim_hash\)\);/);
  assert.match(lock, /Mapping::set\(claim_triage_states, claim_hash, triage\);/);

  assert.match(request, /assert_eq\(current\.status, 1u8\);/);
  assert.match(request, /status: 2u8/);
  assert.match(share, /assert_eq\(reporter, signer\);/);
  assert.match(share, /assert_eq\(current\.status, 2u8\);/);
  assert.match(share, /status: 3u8/);
  assert.match(patch, /assert_eq\(current\.status, 3u8\);/);
  assert.match(patch, /status: 4u8/);

  assert.match(release, /credits\.aleo::transfer_public/);
  assert.match(release, /assert_eq\(payout\.status, 1u8\);/);
  assert.match(release, /assert_eq\(payout\.whitehat_address, whitehat_address\);/);
  assert.match(release, /assert_eq\(triage\.status, 4u8\);/);
  assert.match(release, /assert\(escrow\.locked_amount >= reward_amount\);/);
  assert.match(release, /Mapping::set\(bounty_claim_counts, bounty_id, unresolved_claims - 1u64\);/);
  assert.match(release, /Mapping::set\(escrow_operation_markers, operation_marker, true\);/);
  assert.ok(release.indexOf("transfer.run();") > release.indexOf("assert(escrow.locked_amount >= reward_amount);"));

  assert.match(reject, /aleo19cavyq6przvp7d5yjtpm60z5nh58rqd0vc3zr8q409fdqdtn7ypq8vfqx6/);
  assert.doesNotMatch(reject, /assert_eq\(bounty\.owner_address, signer\);/);
  assert.match(reject, /available_balance: escrow\.available_balance \+ payout\.reward_amount/);
  assert.match(reject, /Mapping::set\(claim_payouts, claim_hash, rejected_payout\);/);
  assert.match(reject, /Mapping::set\(bounty_claim_counts, bounty_id, unresolved_claims - 1u64\);/);

  assert.match(refund, /assert_eq\(bounty\.status, 3u8\);/);
  assert.match(refund, /assert\(block\.height > bounty\.disclosure_deadline\);/);
  assert.match(refund, /assert\(Mapping::contains\(bounty_claim_counts, bounty_id\)\);/);
  assert.match(refund, /assert_eq\(escrow\.locked_amount, 0u64\);/);
  assert.match(refund, /assert_eq\(claim_count, 0u64\);/);
  assert.match(refund, /assert_eq\(escrow\.status, 1u8\);/);
  assert.match(refund, /assert_eq\(escrow\.available_balance, amount\);/);
  assert.match(refund, /available_balance: 0u64/);
  assert.match(refund, /status: 3u8/);
});

test("escrow state model accepts valid fund, lock, and release flow", () => {
  const bounty: SimBounty = { owner: OWNER, status: 1, deadline: 100 };
  const claim: SimClaim = {
    bountyId: BOUNTY_ID,
    proofStatus: 1,
    reporter: WHITEHAT,
    severity: 3,
  };
  const escrow = fundBounty(bounty, OWNER, null, 1_000);
  escrow.claimCount = 1;

  lockReward(bounty, claim, OWNER, escrow, WHITEHAT, 300);
  assert.throws(() => releaseReward(bounty, claim, OWNER, escrow, WHITEHAT, 300));
  requestDisclosure(bounty, OWNER, escrow);
  shareEncryptedDetails(claim, WHITEHAT, escrow, "900field");
  markPatched(bounty, OWNER, escrow);
  releaseReward(bounty, claim, OWNER, escrow, WHITEHAT, 300);

  assert.equal(escrow.available, 700);
  assert.equal(escrow.locked, 0);
  assert.equal(escrow.paid, 300);
  assert.equal(escrow.payouts.get(CLAIM_HASH)?.status, 2);
  assert.equal(escrow.payouts.get(CLAIM_HASH)?.triageStatus, 5);
  assert.equal(escrow.claimCount, 0);
});

test("escrow state model rejects invalid actor, unverified claim, overdraft, and duplicate payout", () => {
  const bounty: SimBounty = { owner: OWNER, status: 1, deadline: 100 };
  const verifiedClaim: SimClaim = {
    bountyId: BOUNTY_ID,
    proofStatus: 1,
    reporter: WHITEHAT,
    severity: 1,
  };
  const rejectedClaim: SimClaim = {
    bountyId: BOUNTY_ID,
    proofStatus: 3,
    reporter: WHITEHAT,
    severity: 1,
  };
  const escrow = fundedEscrow();

  assert.throws(() => fundBounty(bounty, "aleo1attacker", null, 1));
  assert.throws(() => lockReward(bounty, rejectedClaim, OWNER, escrow, WHITEHAT, 100));
  assert.throws(() => lockReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 2_000));
  assert.throws(() => lockReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 200));

  lockReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 100);
  assert.throws(() => lockReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 100));
  assert.throws(() => shareEncryptedDetails(verifiedClaim, WHITEHAT, escrow, "900field"));
  requestDisclosure(bounty, OWNER, escrow);
  assert.throws(() => markPatched(bounty, OWNER, escrow));
  shareEncryptedDetails(verifiedClaim, WHITEHAT, escrow, "900field");
  markPatched(bounty, OWNER, escrow);
  releaseReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 100, "release-2");
  assert.throws(() => releaseReward(bounty, verifiedClaim, OWNER, escrow, WHITEHAT, 100));
});

test("protocol arbiter can reject before details are shared, while owner cannot self-reject", () => {
  const bounty: SimBounty = { owner: OWNER, status: 1, deadline: 100 };
  const claim: SimClaim = {
    bountyId: BOUNTY_ID,
    proofStatus: 1,
    reporter: WHITEHAT,
    severity: 2,
  };
  const escrow = fundedEscrow();
  lockReward(bounty, claim, OWNER, escrow, WHITEHAT, 200);
  assert.throws(() => rejectClaim(claim, OWNER, escrow));
  rejectClaim(claim, ARBITER, escrow);
  assert.equal(escrow.available, 1_000);
  assert.equal(escrow.locked, 0);
  assert.equal(escrow.claimCount, 0);
  assert.equal(escrow.payouts.get(CLAIM_HASH)?.status, 3);

  const preLock = fundedEscrow();
  rejectClaim(claim, ARBITER, preLock, "reject-pre-lock");
  assert.equal(preLock.payouts.get(CLAIM_HASH)?.status, 3);
  assert.equal(preLock.payouts.get(CLAIM_HASH)?.reward, 0);
  assert.equal(preLock.payouts.get(CLAIM_HASH)?.triageStatus, 6);
  assert.equal(preLock.claimCount, 0);
});

test("refund model is one-shot and blocks unresolved, locked, active, or unexpired bounties", () => {
  const closed: SimBounty = { owner: OWNER, status: 3, deadline: 100 };
  const noClaims = fundedEscrow();
  noClaims.claimCount = 0;
  refundBounty(closed, OWNER, noClaims, 1_000, 101);
  assert.equal(noClaims.available, 0);
  assert.equal(noClaims.refunded, 1_000);
  assert.equal(noClaims.status, 3);
  assert.throws(() => refundBounty(closed, OWNER, noClaims, 1, 101, "refund-2"));

  const withClaim = fundedEscrow();
  assert.throws(() => refundBounty(closed, OWNER, withClaim, 1_000, 101));
  const withLocked = fundedEscrow();
  withLocked.claimCount = 0;
  withLocked.locked = 100;
  assert.throws(() => refundBounty(closed, OWNER, withLocked, 1_000, 101));
  const active = fundedEscrow();
  active.claimCount = 0;
  assert.throws(() => refundBounty({ ...closed, status: 1 }, OWNER, active, 1_000, 101));
  const unexpired = fundedEscrow();
  unexpired.claimCount = 0;
  assert.throws(() => refundBounty(closed, OWNER, unexpired, 1_000, 100));
  const partial = fundedEscrow();
  partial.claimCount = 0;
  assert.throws(() => refundBounty(closed, OWNER, partial, 999, 101));
});

test("terminal claim accounting decrements unresolved count exactly once", () => {
  let unresolved = 2;
  const terminalClaims = new Set<string>();
  const settle = (claimHash: string) => {
    assert.equal(terminalClaims.has(claimHash), false);
    assert.ok(unresolved > 0);
    terminalClaims.add(claimHash);
    unresolved -= 1;
  };

  settle("paid-claim");
  settle("rejected-claim");
  assert.equal(unresolved, 0);
  assert.throws(() => settle("paid-claim"));
  assert.throws(() => settle("rejected-claim"));
});
test("escrow server submission remains disabled before and after an upgrade", () => {
  const route = readFileSync("app/api/aleo/escrow/route.ts", "utf8");
  const status = readFileSync("components/reward-escrow-status.tsx", "utf8");

  assert.match(route, /status: 405/);
  assert.match(route, /Server-side Aleo transaction submission is disabled/);
  assert.equal(route.includes("request.json"), false);
  assert.equal(route.includes("requestTransaction"), false);
  assert.match(status, /Program Upgrade Required/);
  assert.match(status, /链上支付尚未激活/);
  assert.match(status, /Confirmed Transaction/);
  assert.match(status, /Mapping Verified/);
});
