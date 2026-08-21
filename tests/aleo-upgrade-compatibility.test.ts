import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  compareAleoUpgradeInterfaces,
  parseAleoProgramInterface,
} from "../lib/aleo-upgrade-interface.ts";

const baselineSource = readFileSync(
  "audit/testnet-edition-0/zkbugbounty_7f3c92.edition-0.aleo",
  "utf8",
).replace(/\r/g, "");
const baseline = parseAleoProgramInterface(baselineSource);
const candidateSource = readFileSync("leo/bug_proof/build/zkbugbounty_7f3c92/zkbugbounty_7f3c92.aleo", "utf8").replace(/\r/g, "");
const candidate = parseAleoProgramInterface(candidateSource);

test("real Testnet edition 0 fixture is the sole preserved-interface baseline", () => {
  assert.equal(baseline.program, "program zkbugbounty_7f3c92.aleo;");
  assert.deepEqual(baseline.imports, []);
  assert.ok(baseline.constructor);
  assert.ok(baseline.functions.submit_claim);
  assert.ok(baseline.finalizes.submit_claim);
});

test("compiled Candidate preserves every real Testnet edition 0 interface", () => {
  const result = compareAleoUpgradeInterfaces(baseline, candidate);
  assert.equal(result.compatible, true);
  assert.deepEqual(result.mismatches, []);
  assert.deepEqual(candidate.functions.submit_claim, baseline.functions.submit_claim);
  assert.deepEqual(candidate.finalizes.submit_claim, baseline.finalizes.submit_claim);
  assert.ok(candidate.functions.submit_claim_v2);
  assert.ok(candidate.finalizes.submit_claim_v2);
  assert.equal(baseline.functions.submit_claim_v2, undefined);
  assert.equal(baseline.finalizes.submit_claim_v2, undefined);
});

test("compiled interface comparison detects constructor, type, callable, finalize, and output drift", () => {
  const mutations = [
    baselineSource.replace("assert.eq program_owner", "assert.neq program_owner"),
    baselineSource.replace("value as BountyState.public;", "value as field.public;"),
    baselineSource.replace(
      "input r5 as u8.public;\n    input r6 as field.public;",
      "input r5 as u64.public;\n    input r6 as field.public;",
    ),
    baselineSource.replace(
      "output r16 as ProofResult.public;",
      "output r16 as field.public;",
    ),
  ];

  for (const source of mutations) {
    assert.notEqual(source, baselineSource);
    assert.equal(
      compareAleoUpgradeInterfaces(
        baseline,
        parseAleoProgramInterface(source),
      ).compatible,
      false,
    );
  }
});

test("legacy economic entries are fail-closed and v2 entries are independent", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");
  for (const functionName of [
    "fund_bounty",
    "lock_reward",
    "release_reward",
    "refund_bounty",
  ]) {
    const start = source.indexOf(`fn ${functionName}(`);
    const end = source.indexOf("\n    fn ", start + 1);
    const block = source.slice(start, end);
    assert.ok(start >= 0, `${functionName} must exist`);
    assert.match(block, /assert_eq\((?:amount|reward_amount), 0u64\);/);
    assert.match(block, /assert_neq\((?:amount|reward_amount), 0u64\);/);
  }

  for (const functionName of [
    "fund_bounty_v2",
    "lock_reward_v2",
    "release_reward_v2",
    "refund_bounty_v2",
  ]) {
    assert.match(source, new RegExp(`\\bfn ${functionName}\\(`));
  }

  const fundV2 = source.slice(
    source.indexOf("fn fund_bounty_v2"),
    source.indexOf("fn lock_reward"),
  );
  assert.match(fundV2, /credits\.aleo::transfer_public_as_signer/);
  assert.match(fundV2, /transfer\.run\(\);/);
  assert.match(fundV2, /Mapping::set\(bounty_escrows/);
});

test("frozen fund_bounty preserves its Testnet future-first finalizer ABI", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");
  const start = source.indexOf("fn fund_bounty(");
  const end = source.indexOf("\n    fn fund_bounty_v2(", start);
  const block = source.slice(start, end);

  assert.ok(start >= 0 && end > start, "fund_bounty boundary must exist");
  assert.match(block, /assert_eq\(amount, 0u64\);/);
  assert.match(block, /assert_neq\(amount, 0u64\);/);
  assert.ok(
    block.indexOf("transfer.run();") < block.indexOf("assert(amount > 0u64);"),
    "the immutable legacy Credits future must remain first in the finalizer ABI",
  );
});
