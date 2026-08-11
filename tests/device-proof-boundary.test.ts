import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DEVICE_PROOF_BOUNDARY } from "../lib/device-proof-boundary.ts";

test("Real Mode uses the wallet device boundary with no server or Mock fallback", () => {
  assert.deepEqual(DEVICE_PROOF_BOUNDARY, {
    mode: "leo-wallet-device",
    network: "testnet",
    programId: "zkbugbounty_7f3c92.aleo",
    functionName: "submit_claim_v2",
    serverProofEnabled: false,
    privateInputsAcceptedByApi: false,
    mockFallbackAllowed: false,
  });
});

test("submit page never serializes private proof input into a network request", () => {
  const page = readFileSync("app/submit-proof/page.tsx", "utf8");

  assert.equal(page.includes("/api/aleo/prove"), false);
  assert.equal(page.includes("generateAleoProof"), false);
  assert.equal(page.includes("JSON.stringify({ input"), false);
  assert.equal(page.includes("localStorage"), false);
  assert.equal(page.includes("sessionStorage"), false);
  assert.equal(page.includes("console.log"), false);
  assert.match(page, /wallet\.submitWalletClaimV2\(/);
});

test("server prove route never parses request bodies or imports a proof engine", () => {
  const route = readFileSync("app/api/aleo/prove/route.ts", "utf8");

  for (const forbidden of [
    "request.json",
    "PrivateProofInput",
    "createAleoProgramEngine",
    "reporterSecret",
    "hiddenDeltaBalance",
  ]) {
    assert.equal(route.includes(forbidden), false, `${forbidden} must not be processed by the API`);
  }
  assert.match(route, /status:\s*410/);
});

test("wallet call stack clears transient inputs on every outcome", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const submitPage = readFileSync("app/submit-proof/page.tsx", "utf8");

  assert.match(provider, /finally\s*\{[\s\S]*?inputs\.fill\(""\)/);
  assert.match(provider, /request\.witness\[key\]\s*=\s*""/);
  assert.match(submitPage, /finally\s*\{[\s\S]*?clearPrivateInputState\(\)/);
  assert.equal(provider.includes("console.log"), false);
});
