import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const scriptPath = "scripts/deploy-aleo-testnet.sh";
const script = readFileSync(scriptPath, "utf8").replace(/\r\n/g, "\n");
const privateKeyLiteralPrefix = ["A", "PrivateKey"].join("");

test("Aleo Testnet deployment script keeps key entry manual and process-scoped", () => {
  assert.equal(script.startsWith("#!/usr/bin/env bash\nset -euo pipefail\n"), true);
  assert.equal(script.includes('read -rsp "Aleo Testnet deployer private key: " PRIVATE_KEY'), true);
  assert.equal(script.includes('PRIVATE_KEY="$PRIVATE_KEY" \\\n'), true);
  assert.equal(script.includes("export PRIVATE_KEY"), false);
  assert.equal(script.includes("--yes"), false);
  assert.equal(script.includes(" -y"), false);
  assert.equal(script.includes(privateKeyLiteralPrefix), false);
  assert.equal(script.includes("trap cleanup EXIT"), true);
  assert.equal(script.includes("unset -v PRIVATE_KEY"), true);
});

test("Aleo Testnet deployment script completes public checks before reading a key", () => {
  const readIndex = script.indexOf('read -rsp "Aleo Testnet deployer private key: " PRIVATE_KEY');

  for (const requiredCheck of [
    "\"${LEO_BIN}\" clean",
    "\"${LEO_BIN}\" build",
    "block/height/latest",
    "stateRoot/latest",
    "PROGRAM_STATUS",
    "scan_for_private_key_literals",
    "assert.eq program_owner",
  ]) {
    const checkIndex = script.indexOf(requiredCheck);
    assert.notEqual(checkIndex, -1, `${requiredCheck} must be checked`);
    assert.ok(checkIndex < readIndex, `${requiredCheck} must run before private-key entry`);
  }
});

test("Aleo Testnet deployment script preserves interactive confirmation and public-only output", () => {
  for (const requiredValue of [
    "zkbugbounty_7f3c92.aleo",
    "https://api.explorer.provable.com/v1",
    "--broadcast",
    "--network-retries 6",
    '--json-output="$RESULT_FILENAME"',
    "Deployment Transaction ID:",
    "deployment_result.json",
  ]) {
    assert.equal(script.includes(requiredValue), true, `${requiredValue} must be present`);
  }

  assert.equal(script.includes("$HOME"), false);
  assert.equal(script.includes("/home/"), false);
  assert.equal(script.includes("deployment_result.json"), true);
});
