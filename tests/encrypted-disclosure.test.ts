import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decryptDisclosureReport,
  deriveDisclosureKeyCommitment,
  encryptDisclosureReport,
  exportDisclosureKeyBundle,
  exportDisclosurePublicKey,
  generateDisclosureRecipientKeys,
  verifyDisclosurePackageHash,
  verifyProtocolDisclosureBinding,
} from "../lib/encrypted-disclosure.ts";
import {
  createInitialDemoState,
  lockReward,
  requestEncryptedDetails,
  shareEncryptedDetails,
} from "../lib/store.ts";

const subtle = webcrypto.subtle as unknown as SubtleCrypto;

test("Whitehat encrypts for the owner and owner decrypts locally", async () => {
  const ownerKeys = await generateDisclosureRecipientKeys({ subtle });
  const plaintext = "confidential reproduction details known only to the project owner";
  const encrypted = await encryptDisclosureReport(
    {
      claimId: "claim-test-1",
      plaintext,
      recipient: exportDisclosurePublicKey(ownerKeys),
      protocolCommitment: "42field",
    },
    {
      subtle,
      randomValues: (bytes) => {
        bytes.fill(7);
        return bytes;
      },
      now: () => "2026-07-19T00:00:00.000Z",
    },
  );

  assert.equal(await verifyDisclosurePackageHash(encrypted, { subtle }), true);
  assert.equal(JSON.stringify(encrypted).includes(plaintext), false);
  assert.match(encrypted.packageHash, /^0x[0-9a-f]{64}$/);
  assert.equal(encrypted.protocolCommitment, "42field");
  assert.equal(
    await verifyProtocolDisclosureBinding(
      encrypted,
      { claimId: "claim-test-1", protocolCommitment: "42field" },
      { subtle },
    ),
    true,
  );
  assert.equal(
    await decryptDisclosureReport(
      { package: encrypted, recipientKeys: exportDisclosureKeyBundle(ownerKeys) },
      { subtle },
    ),
    plaintext,
  );
});

test("Protocol V3 disclosure binding rejects a swapped claim or field commitment", async () => {
  const ownerKeys = await generateDisclosureRecipientKeys({ subtle });
  const encrypted = await encryptDisclosureReport(
    {
      claimId: "12field",
      plaintext: "confidential report",
      recipient: exportDisclosurePublicKey(ownerKeys),
      protocolCommitment: "34field",
    },
    { subtle },
  );

  assert.equal(
    await verifyProtocolDisclosureBinding(
      encrypted,
      { claimId: "13field", protocolCommitment: "34field" },
      { subtle },
    ),
    false,
  );
  assert.equal(
    await verifyProtocolDisclosureBinding(
      encrypted,
      { claimId: "12field", protocolCommitment: "35field" },
      { subtle },
    ),
    false,
  );
});

test("a deterministic non-zero Aleo field commits exactly one disclosure public key", async () => {
  const ownerKeys = await generateDisclosureRecipientKeys({ subtle });
  const otherKeys = await generateDisclosureRecipientKeys({ subtle });
  const commitment = await deriveDisclosureKeyCommitment(ownerKeys, { subtle });

  assert.match(commitment, /^[1-9][0-9]*field$/);
  assert.equal(
    await deriveDisclosureKeyCommitment(exportDisclosurePublicKey(ownerKeys), { subtle }),
    commitment,
  );
  assert.notEqual(await deriveDisclosureKeyCommitment(otherKeys, { subtle }), commitment);
});

test("wrong recipient key cannot decrypt a disclosure package", async () => {
  const ownerKeys = await generateDisclosureRecipientKeys({ subtle });
  const wrongKeys = await generateDisclosureRecipientKeys({ subtle });
  const encrypted = await encryptDisclosureReport(
    {
      claimId: "claim-test-2",
      plaintext: "confidential report",
      recipient: exportDisclosurePublicKey(ownerKeys),
    },
    { subtle },
  );

  await assert.rejects(
    decryptDisclosureReport(
      { package: encrypted, recipientKeys: exportDisclosureKeyBundle(wrongKeys) },
      { subtle },
    ),
    /recipient mismatch/,
  );
});

test("tampered ciphertext fails package integrity before decryption", async () => {
  const ownerKeys = await generateDisclosureRecipientKeys({ subtle });
  const encrypted = await encryptDisclosureReport(
    {
      claimId: "claim-test-3",
      plaintext: "confidential report",
      recipient: exportDisclosurePublicKey(ownerKeys),
    },
    { subtle },
  );
  const replacement = encrypted.ciphertext.endsWith("A") ? "B" : "A";
  const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -1)}${replacement}` };

  assert.equal(await verifyDisclosurePackageHash(tampered, { subtle }), false);
  await assert.rejects(
    decryptDisclosureReport(
      { package: tampered, recipientKeys: exportDisclosureKeyBundle(ownerKeys) },
      { subtle },
    ),
    /integrity check failed/,
  );
});

test("store records only public disclosure attestation metadata", () => {
  let state = createInitialDemoState();
  const claim = state.claims[0];
  const owner = state.actors.find((actor) => actor.role === "ProjectOwner")!;
  const whitehat = state.actors.find((actor) => actor.role === "Whitehat")!;
  state = lockReward(state, owner, claim.id);
  state = requestEncryptedDetails(state, owner, claim.id);
  state = shareEncryptedDetails(state, whitehat, claim.id, {
    packageHash: `0x${"c".repeat(64)}`,
    recipientKeyId: `0x${"d".repeat(64)}`,
  });

  const serialized = JSON.stringify(state.disclosurePackages);
  assert.match(serialized, /recipientKeyId/);
  assert.equal(serialized.includes("ciphertext"), false);
  assert.equal(serialized.includes("decryptionKey"), false);
  assert.equal(serialized.includes("confidential report"), false);
});

test("encrypted disclosure UI has no server or browser persistence transport", () => {
  const component = readFileSync("components/encrypted-disclosure-workbench.tsx", "utf8");
  assert.equal(component.includes("fetch("), false);
  assert.equal(component.includes("localStorage"), false);
  assert.equal(component.includes("sessionStorage"), false);
  assert.equal(component.includes("console.log"), false);
  assert.match(component, /URL\.createObjectURL/);
  assert.match(component, /setReport\(""\)/);
  assert.match(component, /setDecryptionKeyInput\(""\)/);
});

test("Protocol V3 secure delivery keeps private packages local and binds them to public commitments", () => {
  const component = readFileSync("components/protocol-v3-secure-delivery.tsx", "utf8");

  assert.equal(component.includes("fetch("), false);
  assert.equal(component.includes("localStorage"), false);
  assert.equal(component.includes("sessionStorage"), false);
  assert.equal(component.includes("console.log"), false);
  assert.match(component, /protocolCommitment: reportCommitment/);
  assert.match(component, /protocolCommitment: disputeCommitment/);
  assert.match(component, /deriveDisclosureKeyCommitment/);
  assert.match(component, /recipientCommitment !== disclosureKeyCommitment/);
  assert.match(component, /Promise\.all\(arbiters\.map/);
  assert.match(component, /setReport\(""\)/);
  assert.match(component, /setArbitrationEvidence\(""\)/);
  assert.match(component, /URL\.createObjectURL/);
});
