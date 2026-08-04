import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  fetchOnChainNullifierState,
  parseOnChainNullifierState,
} from "../lib/aleo-nullifier-registry.ts";
import type { AleoBountyRegistryConfig } from "../lib/aleo-bounty-registry.ts";
import { assertNoPrivateFields } from "../lib/privacy-guards.ts";
import { handleAleoNullifierLookup } from "../app/api/aleo/nullifiers/[nullifier]/route.ts";

const config: AleoBountyRegistryConfig = {
  endpoint: "https://api.explorer.provable.com/v1",
  network: "testnet",
  programId: "zkbugbounty_7f3c92.aleo",
};

test("Leo submit_claim enforces the authoritative nullifier mapping in Final", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");

  assert.match(source, /mapping nullifiers: field => field;/);
  assert.match(source, /fn submit_claim\([\s\S]*?\) -> \(public ProofResult, Final\)/);
  assert.match(source, /let proof: ProofResult = compute_vault_invariant_break\(/);
  assert.match(source, /assert\(!Mapping::contains\(nullifiers, nullifier\)\);/);
  assert.match(source, /Mapping::set\(nullifiers, nullifier, bounty_id\);/);

  const containsIndex = source.indexOf("assert(!Mapping::contains(nullifiers, nullifier));");
  const setIndex = source.indexOf("Mapping::set(nullifiers, nullifier, bounty_id);");
  assert.equal(containsIndex >= 0 && setIndex > containsIndex, true);
});

test("submit_claim validates the canonical active bounty before consuming a nullifier", () => {
  const source = readFileSync("leo/bug_proof/src/main.leo", "utf8");
  const submitClaim = source.slice(
    source.indexOf("fn submit_claim"),
    source.indexOf("fn submit_claim_v2"),
  );

  assert.match(submitClaim, /Mapping::contains\(bounties, bounty_id\)/);
  assert.match(submitClaim, /assert_eq\(bounty\.scope_hash, scope_hash\)/);
  assert.match(submitClaim, /assert_eq\(bounty\.rule_id, rule_id\)/);
  assert.match(submitClaim, /assert_eq\(bounty\.status, 1u8\)/);
  assert.match(submitClaim, /std::ctx::block_height\(\) <= bounty\.disclosure_deadline/);
  assert.doesNotMatch(submitClaim, /self\.signer|claim_reporters|bounty_claim_counts/);
});

test("strict Aleo nullifier parser returns public mapping state", () => {
  const state = parseOnChainNullifierState('"5001field"', "9001field", config);

  assert.deepEqual(state, {
    nullifier: "9001field",
    bountyId: "5001field",
    used: true,
    source: "AleoTestnet",
    network: "testnet",
    programId: "zkbugbounty_7f3c92.aleo",
    mapping: "nullifiers",
  });
  assertNoPrivateFields(state);
});

test("Aleo nullifier parser rejects malformed mapping values", () => {
  assert.throws(
    () => parseOnChainNullifierState('"not-a-field"', "9001field", config),
    /invalid bounty ID/,
  );
  assert.throws(
    () => parseOnChainNullifierState('"5001field"', "not-a-field", config),
    /Invalid Aleo nullifier/,
  );
});

test("nullifier fetch reads the canonical Aleo Testnet mapping URL", async () => {
  let requestedUrl = "";
  const state = await fetchOnChainNullifierState("9001field", config, async (input) => {
    requestedUrl = String(input);
    return new Response('"5001field"', { status: 200 });
  });

  assert.equal(
    requestedUrl,
    "https://api.explorer.provable.com/v1/testnet/program/zkbugbounty_7f3c92.aleo/mapping/nullifiers/9001field",
  );
  assert.equal(state?.bountyId, "5001field");
});

test("nullifier fetch treats Provable HTTP 200 null as unused", async () => {
  const state = await fetchOnChainNullifierState(
    "9001field",
    config,
    async () => new Response("null", { status: 200 }),
  );

  assert.equal(state, null);
});

test("Nullifier lookup API never falls back to local demo state", async () => {
  const unavailable = await handleAleoNullifierLookup("9001field", { config: null });
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, {
    error: "Aleo Testnet registry is not configured",
    source: "Unconfigured",
  });

  const found = await handleAleoNullifierLookup("9001field", {
    config,
    fetcher: async () => new Response('"5001field"', { status: 200 }),
  });
  assert.equal(found.status, 200);
  assertNoPrivateFields(found.body);
});

test("submit proof UI labels local duplicate checks as UX and queries only public nullifiers", () => {
  const panel = readFileSync("components/aleo-nullifier-status.tsx", "utf8");
  const packageJson = readFileSync("package.json", "utf8");

  assert.match(panel, /本地检查仅用于 Demo UX/);
  assert.match(panel, /\/api\/aleo\/nullifiers\//);
  assert.equal(panel.includes("localStorage"), true);
  assert.match(panel, /不会回退到 localStorage 或 Demo State/);
  assert.equal(panel.includes("localStorage.setItem"), false);
  assert.equal(panel.includes("sessionStorage"), false);
  assert.equal(panel.includes("reporterSecret"), false);
  assert.equal(panel.includes("hiddenDelta"), false);
  assert.match(packageJson, /leo:run:submit-claim/);
});
