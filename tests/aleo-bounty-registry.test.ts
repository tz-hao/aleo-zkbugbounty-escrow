import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  fetchOnChainBountyState,
  getAleoBountyRegistryConfig,
  parseOnChainBountyState,
  type AleoBountyRegistryConfig,
} from "../lib/aleo-bounty-registry.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import { handleAleoBountyLookup } from "../app/api/aleo/bounties/[bountyId]/route.ts";

const config: AleoBountyRegistryConfig = {
  endpoint: "https://api.explorer.provable.com/v1",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
};

const mappingValue = `{
  owner_address: aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px,
  scope_hash: 6001field,
  rule_id: 1field,
  critical_reward: 1000u64,
  high_reward: 500u64,
  medium_reward: 100u64,
  low_reward: 10u64,
  disclosure_deadline: 20000000u32,
  status: 1u8
}`;

test("Leo Bounty Registry uses signer-owned Final mapping transitions", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");

  assert.match(source, /mapping bounties: field => BountyState;/);
  assert.match(source, /fn create_bounty\([\s\S]*?\) -> Final/);
  assert.match(source, /fn pause_bounty\(public bounty_id: field\) -> Final/);
  assert.match(source, /fn close_bounty\(public bounty_id: field\) -> Final/);
  assert.match(source, /let signer = std::ctx::signer\(\);/);
  assert.match(source, /return final \{/);
  assert.match(source, /assert_eq\(current\.owner_address, signer\)/);
  assert.equal(source.includes("public owner"), false);
  assert.equal(source.includes("ownerId"), false);
});

test("strict Aleo mapping parser returns public Bounty state", () => {
  const bounty = parseOnChainBountyState(mappingValue, "5001field", config);

  assert.equal(bounty.bountyId, "5001field");
  assert.equal(bounty.owner.startsWith("aleo1"), true);
  assert.equal(bounty.ruleId, "vault-accounting-safety");
  assert.equal(bounty.rewards.critical, "1000");
  assert.equal(bounty.disclosureDeadline, 20_000_000);
  assert.equal(bounty.status, "Active");
  assert.equal(bounty.source, "AleoTestnet");
  assertNoPrivateFields(bounty);
});

test("Aleo mapping parser rejects unknown or private fields", () => {
  const injected = mappingValue.replace("status: 1u8", "status: 1u8, reporter_secret: 9field");
  assert.throws(() => parseOnChainBountyState(injected, "5001field", config), /unexpected field/);
  assert.throws(() => parseOnChainBountyState(mappingValue, "not-a-field", config), /Invalid Aleo bounty ID/);
});

test("registry fetch reads the canonical Aleo Testnet mapping URL", async () => {
  let requestedUrl = "";
  const bounty = await fetchOnChainBountyState("5001field", config, async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify(mappingValue), { status: 200 });
  });

  assert.equal(
    requestedUrl,
    "https://api.explorer.provable.com/v1/testnet/program/zkbugbounty_7f3c92.aleo/mapping/bounties/5001field",
  );
  assert.equal(bounty?.programId, "zkbugbounty_7f3c92.aleo");
});

test("registry configuration defaults to the deployed canonical Program ID and requires HTTPS", () => {
  assert.deepEqual(getAleoBountyRegistryConfig({}), config);
  assert.throws(
    () => getAleoBountyRegistryConfig({ ALEO_PROGRAM_ID: "different_program.aleo" }),
    /canonical Leo Program ID/,
  );
  assert.throws(
    () => getAleoBountyRegistryConfig({ ALEO_PROGRAM_ID: "zkbugbounty_7f3c92.aleo", ALEO_API_ENDPOINT: "http://example.com" }),
    /must use HTTPS/,
  );
});

test("Bounty lookup API never falls back to demo state", async () => {
  const unavailable = await handleAleoBountyLookup("5001field", { config: null });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, {
    error: "Aleo Testnet registry is not configured",
    source: "Unconfigured",
  });

  const found = await handleAleoBountyLookup("5001field", {
    config,
    fetcher: async () => new Response(mappingValue, { status: 200 }),
  });
  assert.equal(found.status, 200);
  assertNoPrivateFields(found.body);
});

test("Public Claims exposes a read-only Aleo Registry lookup without persistence", () => {
  const page = readFileSync("app/public-claims/page.tsx", "utf8");
  const panel = readFileSync("components/aleo-bounty-registry-panel.tsx", "utf8");
  assert.match(page, /AleoBountyRegistryPanel/);
  assert.match(panel, /\/api\/aleo\/bounties\//);
  assert.equal(panel.includes("localStorage.setItem"), false);
  assert.equal(panel.includes("sessionStorage"), false);
});
