import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { encryptDisclosureReport, parseDisclosurePublicKey } from "../lib/encrypted-disclosure.ts";

test("triage fixture includes an importable public key and a non-sensitive report", async () => {
  const publicKey = readFileSync("docs/fixtures/triage-owner-public-key.fixture.json", "utf8");
  const report = readFileSync("docs/fixtures/triage-private-disclosure-report.fixture.txt", "utf8");
  const parsedKey = parseDisclosurePublicKey(publicKey);

  assert.equal(parsedKey.version, "zkbb-disclosure-key-v1");
  assert.equal(parsedKey.algorithm, "ECDH-P256");
  assert.match(parsedKey.keyId, /^0x[0-9a-f]{64}$/);
  const encrypted = await encryptDisclosureReport(
    { claimId: "fixture-claim", plaintext: report, recipient: publicKey },
    { subtle: webcrypto.subtle as unknown as SubtleCrypto },
  );
  assert.equal(encrypted.ciphertext.includes(report), false);
  for (const forbidden of ["Private Key", "Seed Phrase", "View Key", "PoC", "exploit path", "triggering parameter"]) {
    assert.equal(report.includes(forbidden), false, `${forbidden} must not appear in the fixture report`);
  }
});
