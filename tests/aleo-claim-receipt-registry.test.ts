import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  fetchOnChainClaimReceipt,
  parseOnChainClaimReceipt,
} from "../lib/aleo-claim-receipt-registry.ts";
import type { AleoBountyRegistryConfig } from "../lib/aleo-bounty-registry.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import { handleAleoClaimReceiptLookup } from "../app/api/aleo/receipts/[claimHash]/route.ts";

const config: AleoBountyRegistryConfig = {
  endpoint: "https://api.explorer.provable.com/v1",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
};

const mappingValue = `{
  claim_hash: 7001field,
  bounty_id: 5001field,
  rule_id: 1field,
  scope_hash: 6001field,
  severity: 3u8,
  witness_commitment: 8001field,
  nullifier: 9001field,
  reporter_commitment: 10001field,
  proof_status: 1u8,
  created_height: 20000000u32,
  protocol_version: 1u8
}`;

test("Leo submit_claim atomically writes the trusted on-chain Claim Receipt", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");
  const submitClaim = source.slice(source.indexOf("fn submit_claim"), source.indexOf("fn create_bounty"));

  assert.match(source, /struct ClaimReceiptState \{/);
  assert.match(source, /mapping claim_receipts: field => ClaimReceiptState;/);
  assert.match(submitClaim, /let claim_hash: field = proof\.claim_hash;/);
  assert.match(submitClaim, /let severity: u8 = proof\.severity;/);
  assert.match(submitClaim, /let witness_commitment: field = proof\.witness_commitment;/);
  assert.match(submitClaim, /let reporter_commitment: field = proof\.reporter_commitment;/);
  assert.match(submitClaim, /created_height: block\.height/);
  assert.match(submitClaim, /Mapping::get_or_use\([\s\S]*bounty_protocol_versions,[\s\S]*1u8/);
  assert.match(submitClaim, /protocol_version: bounty_protocol_version/);
  assert.match(submitClaim, /Mapping::set\(nullifiers, nullifier, bounty_id\);/);
  assert.match(submitClaim, /Mapping::set\(claim_receipts, claim_hash, receipt\);/);
});

test("strict Claim Receipt parser returns only verified public protocol fields", () => {
  const receipt = parseOnChainClaimReceipt(mappingValue, "7001field", config);

  assert.equal(receipt.claimHash, "7001field");
  assert.equal(receipt.bountyId, "5001field");
  assert.equal(receipt.ruleId, "vault-accounting-safety");
  assert.equal(receipt.severity, "Critical");
  assert.equal(receipt.proofStatus, "Verified");
  assert.equal(receipt.createdHeight, 20_000_000);
  assert.equal(receipt.protocolVersion, 1);
  assert.equal(receipt.source, "AleoTestnet");
  assertNoPrivateFields(receipt);
});

test("Claim Receipt parser rejects key mismatch, low impact, and private field injection", () => {
  assert.throws(
    () => parseOnChainClaimReceipt(mappingValue, "7002field", config),
    /does not match/,
  );
  assert.throws(
    () => parseOnChainClaimReceipt(mappingValue.replace("severity: 3u8", "severity: 0u8"), "7001field", config),
    /unsupported protocol value/,
  );
  assert.throws(
    () => parseOnChainClaimReceipt(
      mappingValue.replace("protocol_version: 1u8", "protocol_version: 1u8, reporter_secret: 2field"),
      "7001field",
      config,
    ),
    /unexpected field/,
  );
});

test("Claim Receipt fetch reads the canonical Aleo Testnet mapping URL", async () => {
  let requestedUrl = "";
  const receipt = await fetchOnChainClaimReceipt("7001field", config, async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify(mappingValue), { status: 200 });
  });

  assert.equal(
    requestedUrl,
    "https://api.explorer.provable.com/v1/testnet/program/zkbugbounty_7f3c92.aleo/mapping/claim_receipts/7001field",
  );
  assert.equal(receipt?.mapping, "claim_receipts");
});

test("Claim Receipt fetch treats Provable HTTP 200 null as missing", async () => {
  const receipt = await fetchOnChainClaimReceipt(
    "7001field",
    config,
    async () => new Response("null", { status: 200 }),
  );

  assert.equal(receipt, null);
});

test("Claim Receipt lookup API never falls back to a local or Mock receipt", async () => {
  const unavailable = await handleAleoClaimReceiptLookup("7001field", { config: null });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, {
    error: "Aleo Testnet registry is not configured",
    source: "Unconfigured",
  });

  const found = await handleAleoClaimReceiptLookup("7001field", {
    config,
    fetcher: async () => new Response(mappingValue, { status: 200 }),
  });
  assert.equal(found.status, 200);
  assertNoPrivateFields(found.body);
});

test("Public Claims exposes read-only Aleo receipts without browser persistence", () => {
  const page = readFileSync("app/public-claims/page.tsx", "utf8");
  const panel = readFileSync("components/aleo-claim-receipt-panel.tsx", "utf8");

  assert.match(page, /AleoClaimReceiptPanel/);
  assert.match(panel, /\/api\/aleo\/receipts\//);
  assert.equal(page.includes("本地演示 Registry"), false);
  assert.equal(page.includes("Local simulation"), false);
  assert.equal(panel.includes("不会使用 localStorage、Mock Receipt 或 Demo State"), false);
  assert.equal(panel.includes("localStorage.setItem"), false);
  assert.equal(panel.includes("sessionStorage"), false);
  assert.equal(panel.includes("reporterSecret"), false);
  assert.equal(panel.includes("hiddenDelta"), false);
});
