import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDuplicateNullifierPublicPreview,
  DUPLICATE_NULLIFIER_TEST_BOUNDARY,
  DUPLICATE_TEST_PRIVATE_INPUT_STATES,
  expectedClaimCountAfterFirst,
  expectedClaimCountAfterRejectedDuplicate,
  zeroControlledDuplicateInputs,
  type ControlledDuplicateNullifierVector,
} from "../lib/duplicate-nullifier-test.ts";
import { SUBMIT_CLAIM_ABI_INPUTS } from "../lib/aleo-submit-claim.ts";

function vector(overrides: Partial<ControlledDuplicateNullifierVector> = {}) {
  return {
    inputs: [
      "257640041950318553814753415615134947371field",
      "165263616045655158386888829934414575403field",
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
    ],
    feeMicrocredits: 5_000_000,
    claimHash: "4950888461585098134292682974513592867704186703432861593079938832340863836108field",
    nullifier: "43001239010982667359056940308599159854211339523745281394136644355935576010field",
    witnessCommitment: "722872926179576683690614719485200689525838241055546155418101915563966751367field",
    reporterCommitment: "4502045744747697779677218696692067578094009398024476490314910073246799335964field",
    severity: "3u8",
    ...overrides,
  };
}

test("controlled duplicate nullifier boundary is Testnet-only with no Mock fallback", () => {
  assert.deepEqual(DUPLICATE_NULLIFIER_TEST_BOUNDARY, {
    route: "/security-tests/duplicate-nullifier",
    network: "testnet",
    programId: "zkbugbounty_7f3c92.aleo",
    functionName: "submit_claim",
    usesNextApiRoutes: false,
    usesBrowserPersistence: false,
    mockFallbackAllowed: false,
    serverSigningAllowed: false,
  });
  assert.equal(DUPLICATE_TEST_PRIVATE_INPUT_STATES.includes("DUPLICATE_READY"), true);
  assert.equal(DUPLICATE_TEST_PRIVATE_INPUT_STATES.includes("CLEARED"), false);
});

test("public preview exposes only public receipt fields and keeps 16 ABI inputs out", () => {
  const source = vector();
  const preview = buildDuplicateNullifierPublicPreview(source);

  assert.equal(source.inputs.length, SUBMIT_CLAIM_ABI_INPUTS.length);
  assert.equal(preview.programId, "zkbugbounty_7f3c92.aleo");
  assert.equal(preview.functionName, "submit_claim");
  assert.equal(preview.bountyId, source.inputs[0]);
  assert.equal(preview.scopeHash, source.inputs[1]);
  assert.equal(preview.rule, source.inputs[2]);
  assert.equal(preview.claimHash, source.claimHash);
  assert.equal(preview.nullifier, source.nullifier);
  assert.equal(preview.expectedDuplicateStatus, "rejected");
  assert.equal(JSON.stringify(preview).includes("hidden_delta"), false);
  assert.equal(JSON.stringify(preview).includes("123456field"), false);
});

test("duplicate pair keeps the same nullifier and does not regenerate inputs", () => {
  const pair = vector();
  const firstInputs = pair.inputs;
  const firstNullifier = buildDuplicateNullifierPublicPreview(pair).nullifier;
  const secondNullifier = buildDuplicateNullifierPublicPreview(pair).nullifier;

  assert.equal(firstInputs, pair.inputs);
  assert.equal(firstNullifier, secondNullifier);
  assert.deepEqual(pair.inputs, firstInputs);
});

test("duplicate test clears transient vector values in place", () => {
  const pair = vector();
  zeroControlledDuplicateInputs(pair);
  assert.deepEqual(pair.inputs, Array.from({ length: SUBMIT_CLAIM_ABI_INPUTS.length }, () => ""));
});

test("public claim count uses baseline N, not a hard-coded one-claim assumption", () => {
  assert.equal(expectedClaimCountAfterFirst(0), 1);
  assert.equal(expectedClaimCountAfterFirst(7), 8);
  assert.equal(expectedClaimCountAfterRejectedDuplicate(7), 8);
  assert.throws(() => expectedClaimCountAfterFirst(-1), /baseline/);
});

test("dedicated duplicate nullifier page avoids persistence, API routes, and logs", () => {
  const page = readFileSync("app/security-tests/duplicate-nullifier/page.tsx", "utf8");
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const submitPage = readFileSync("app/submit-proof/page.tsx", "utf8");

  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "console.log",
    "/api/",
    "fetch(",
  ]) {
    assert.equal(page.includes(forbidden), false, `${forbidden} must not be used by the test page`);
  }

  assert.match(page, /__zkbbLoadDuplicateNullifierVector/);
  assert.match(page, /zkbb:controlled-duplicate-vector/);
  assert.match(page, /window\.addEventListener\("message"/);
  assert.match(page, /event\.origin !== window\.location\.origin/);
  assert.match(page, /useRef<ControlledDuplicateNullifierVector \| null>/);
  assert.match(page, /window\.addEventListener\("pagehide"/);
  assert.match(page, /window\.addEventListener\("beforeunload"/);
  assert.match(page, /clearDuplicateTestWitness\("CLEARED"\)/);
  assert.match(page, /wallet\.connectionState === "Disconnected"/);
  assert.match(page, /inputs: vectorRef\.current\.inputs/);
  assert.match(page, /finally\s*\{[\s\S]*?clearDuplicateTestWitness\("CLEARED"\)/);

  assert.match(provider, /submitControlledDuplicateClaimInputs/);
  assert.match(provider, /const transientInputs = \[\.\.\.request\.inputs\]/);
  assert.match(provider, /finally\s*\{[\s\S]*?transientInputs\.fill\(""\)/);
  assert.match(submitPage, /finally\s*\{[\s\S]*?clearPrivateInputState\(\)/);
  assert.equal(submitPage.includes("/api/aleo/prove"), false);
});
