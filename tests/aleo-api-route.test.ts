import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GET,
  POST,
  handleAleoProofRequest,
} from "../app/api/aleo/prove/route.ts";

test("aleo prove API refuses all server-side private proving", () => {
  const response = handleAleoProofRequest();

  assert.equal(response.status, 410);
  assert.deepEqual(response.body, {
    error: "Server-side private proving is disabled. Use Leo Wallet device-side submit_claim_v2.",
    privateInputsAccepted: false,
    mode: "leo-wallet-device",
  });
});

test("aleo prove POST rejects without reading or parsing the request body", async () => {
  const response = await POST();
  assert.equal(response.status, 410);
  assert.equal((await response.json()).privateInputsAccepted, false);
});

test("aleo prove GET exposes only the public device-proof capability", async () => {
  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.mode, "leo-wallet-device");
  assert.equal(body.programId, "zkbugbounty_7f3c92.aleo");
  assert.equal(body.functionName, "submit_claim_v2");
  assert.equal(body.serverProofEnabled, false);
  assert.equal(body.privateInputsAcceptedByApi, false);
  assert.equal(body.mockFallbackAllowed, false);
  assert.equal(JSON.stringify(body).includes("reporterSecret"), false);
});
