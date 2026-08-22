import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_EDITION_ONE_VERIFIER_CONFIG,
  verifyPublicEditionOneMapping,
  verifyTestnetEditionOne,
} from "../lib/testnet-edition-one.ts";
import { handlePublicTransactionStatusLookup } from "../app/api/aleo/transactions/[transactionId]/route.ts";
import { handleEditionOneMappingLookup } from "../app/api/aleo/mappings/[mapping]/[key]/route.ts";
import { generateSmokeTestIdentifiers, verifyGeneratedMarkersUnused } from "../scripts/generate-smoke-test-identifiers.mjs";
import { validateSmokeStep } from "../scripts/testnet-edition-1-smoke-assistant.mjs";

const programSource = "program zkbugbounty_7f3c92.aleo;\n";
const validTransactionId = `at1${"a".repeat(58)}`;

function verifiedFetcher(input: string | URL | Request) {
  const url = String(input);
  if (url.endsWith("/latest_edition")) return Promise.resolve(new Response("1"));
  if (url.endsWith(`/transaction/${DEFAULT_EDITION_ONE_VERIFIER_CONFIG.upgradeTransactionId}`)) {
    return Promise.resolve(Response.json({
      id: DEFAULT_EDITION_ONE_VERIFIER_CONFIG.upgradeTransactionId,
      type: "deploy",
      owner: { address: DEFAULT_EDITION_ONE_VERIFIER_CONFIG.adminAddress },
      deployment: {
        edition: 1,
        program: programSource,
        program_owner: DEFAULT_EDITION_ONE_VERIFIER_CONFIG.adminAddress,
      },
    }));
  }
  if (url.endsWith(`/transaction/${DEFAULT_EDITION_ONE_VERIFIER_CONFIG.feeTransactionId}`)) {
    return Promise.resolve(new Response(null, { status: 404 }));
  }
  if (url.includes("credits.aleo/mapping/account")) return Promise.resolve(new Response('"21510312u64"'));
  if (url.includes("/program/zkbugbounty_7f3c92.aleo")) return Promise.resolve(new Response(programSource));
  return Promise.resolve(new Response(null, { status: 404 }));
}

test("Edition 1 verifier accepts confirmed upgrade while Fee transaction indexing is unavailable", async () => {
  const result = await verifyTestnetEditionOne(undefined, verifiedFetcher);
  assert.equal(result.overallVerification, "PASS");
  assert.equal(result.observedEdition, 1);
  assert.equal(result.upgradeStatus, "confirmed");
  assert.equal(result.feeIndexStatus, "INDEX_UNAVAILABLE");
  assert.equal(result.publicBalanceMicrocredits, "21510312");
  assert.equal(JSON.stringify(result).includes("signature"), false);
  assert.equal(JSON.stringify(result).includes("proof"), false);
});

test("Mapping verifier distinguishes not set, indexing delay, transport failure, and malformed key", async () => {
  const notSet = await verifyPublicEditionOneMapping("bounty_escrows", "7field", {
    fetcher: async () => new Response(null, { status: 404 }),
  });
  const delay = await verifyPublicEditionOneMapping("bounty_escrows", "7field", {
    indexDelay: true,
    fetcher: async () => new Response(null, { status: 404 }),
  });
  const failure = await verifyPublicEditionOneMapping("bounty_escrows", "7field", {
    fetcher: async () => new Response(null, { status: 503 }),
  });
  const nullValue = await verifyPublicEditionOneMapping("bounty_escrows", "7field", {
    fetcher: async () => new Response("null", { status: 200 }),
  });
  const malformed = await verifyPublicEditionOneMapping("bounty_escrows", "not-a-field");
  assert.equal(notSet.status, "NOT_SET");
  assert.equal(delay.status, "INDEX_DELAY");
  assert.equal(failure.status, "HTTP_ERROR");
  assert.equal(nullValue.status, "NOT_SET");
  assert.equal(malformed.status, "PARSE_ERROR");
});

test("identifier generator uses distinct public fields and can reject historical markers", async () => {
  let counter = 0;
  const identifiers = generateSmokeTestIdentifiers(() => Buffer.alloc(31, ++counter));
  assert.equal(new Set(Object.values(identifiers)).size, Object.keys(identifiers).length);
  const markerResults = await verifyGeneratedMarkersUnused(
    identifiers,
    async (_mapping, key) => ({ mapping: "escrow_operation_markers", key, status: "NOT_SET", httpStatus: 404, valuePreview: null }),
  );
  assert.equal(Object.values(markerResults).every((result) => result.status === "NOT_SET"), true);
});

test("smoke assistant validates public parameters without generating a signature", () => {
  const validation = validateSmokeStep({
    step: "fund_bounty_v2",
    "bounty-id": "1field",
    amount: "1000000",
    marker: "2field",
  });
  assert.deepEqual(validation, { valid: true, errors: [] });
  assert.equal(validateSmokeStep({ step: "fund_bounty_v2", "bounty-id": "invalid" }).valid, false);
  const assistantSource = readFileSync("scripts/testnet-edition-1-smoke-assistant.mjs", "utf8");
  assert.equal(assistantSource.includes("requestTransaction"), false);
  const privateKeyMarker = ["PRIVATE", "KEY"].join("_");
  assert.equal(assistantSource.includes(privateKeyMarker), false);
});

test("public transaction API classifies indexing 404 as pending and explicit rejection as rejected", async () => {
  const pending = await handlePublicTransactionStatusLookup(validTransactionId, async () => new Response(null, { status: 404 }));
  const rejected = await handlePublicTransactionStatusLookup(validTransactionId, async () => Response.json({ status: "rejected", rejection_reason: "public rejection" }));
  assert.equal(pending.status, 200);
  assert.equal(pending.body.transactionStatus, "pending");
  assert.equal(pending.body.indexStatus, "not_indexed_yet");
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.transactionStatus, "rejected");
});

test("public Mapping API rejects malformed keys before reading the network", async () => {
  const result = await handleEditionOneMappingLookup("escrow_operation_markers", "not-a-field");
  assert.equal(result.status, 400);
  assert.equal("verification" in result.body, false);
});

test("wallet and deployment UI expose only public transaction state and Edition 1 evidence", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const deployment = readFileSync("components/aleo-deployment-status.tsx", "utf8");
  assert.match(provider, /pollPublicTransaction/);
  assert.match(provider, /transactionSubmissionBlocked/);
  assert.match(provider, /escrow_operation_markers/);
  assert.match(provider, /Operation marker already exists/);
  assert.match(provider, /sessionStorage/);
  assert.equal(provider.includes("localStorage"), false);
  assert.match(deployment, /fee transaction index unavailable/);
  assert.match(deployment, /ALEO_TESTNET_EDITION_ONE_UPGRADE/);
});
