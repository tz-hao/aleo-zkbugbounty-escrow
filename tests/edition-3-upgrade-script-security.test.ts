import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { redactAleoCliOutput } from "../scripts/redact-aleo-cli-output.mjs";

const script = readFileSync("scripts/upgrade-aleo-testnet-v3.sh", "utf8").replace(/\r\n/g, "\n");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

test("Edition 3 preview is public-only and exits before any private-key path", () => {
  const previewStart = script.indexOf('if [[ "${MODE}" == "preview" ]]; then');
  const previewEnd = script.indexOf("    exit 0", previewStart);
  const keyRead = script.indexOf('read -rsp "Aleo Testnet administrator private key');
  const preview = script.slice(previewStart, previewEnd);

  assert.ok(previewStart >= 0 && previewEnd > previewStart);
  assert.ok(keyRead > previewEnd);
  assert.match(script, /read_public_credits_balance/);
  assert.match(script, /Public administrator address:/);
  assert.match(script, /Public administrator balance \(microcredits\):/);
  assert.match(script, /Public fee estimate \(microcredits\):/);
  assert.doesNotMatch(preview, /PRIVATE_KEY|read -rsp|upgrade_args|--broadcast|--print|--json-output/);
  assert.doesNotMatch(script, /--print|--json-output/);
});

test("Edition 3 broadcast writes only redacted Leo CLI output", () => {
  const redacted = redactAleoCliOutput([
    "Private Key: simulated-secret-value",
    "upgrade transaction: at1publictransactionvalue",
    "signature: simulated-signature-value",
  ].join("\n"));

  assert.equal(redacted.includes("simulated-secret-value"), false);
  assert.equal(redacted.includes("simulated-signature-value"), false);
  assert.match(redacted, /\[REDACTED_SENSITIVE_LEO_OUTPUT\]/);
  assert.match(redacted, /at1publictransactionvalue/);
  assert.match(script, /PRIVATE_KEY="\$\{PRIVATE_KEY\}" script -qefc "\$\{LEO_UPGRADE_COMMAND\}" \/dev\/null/);
  assert.match(script, /2>&1 \| node "\$\{SCRIPT_DIR\}\/redact-aleo-cli-output\.mjs" >"\$\{LEO_UPGRADE_LOG\}"/);
  assert.doesNotMatch(script, /leo-result\.json|RAW_RESULT/);
  assert.ok(script.indexOf("Type UPGRADE EDITION 3 to continue") < script.indexOf("    --yes"));
});

test("Edition 4 broadcast command pins the public Edition transition", () => {
  assert.equal(
    packageJson.scripts["broadcast:testnet-edition-4"],
    undefined,
  );
});
