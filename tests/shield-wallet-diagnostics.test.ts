import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  diagnoseShieldWalletConnectionError,
  getInjectedShieldWallet,
  inspectShieldWalletProvider,
} from "../lib/shield-wallet-diagnostics.ts";

test("Shield provider detection distinguishes missing and compatible injection", () => {
  const provider = { connect() {}, executeTransaction() {} };

  assert.equal(getInjectedShieldWallet({}), null);
  assert.equal(getInjectedShieldWallet({ shield: provider }), provider);
  assert.equal(inspectShieldWalletProvider(null), "Missing");
  assert.equal(inspectShieldWalletProvider({}), "Incompatible");
  assert.equal(inspectShieldWalletProvider(provider), "Ready");
});

test("Shield connection errors are classified without exposing raw messages", () => {
  const rejected = diagnoseShieldWalletConnectionError(new Error("User rejected request 401"));
  const network = diagnoseShieldWalletConnectionError(new Error("network testnet mismatch"));
  const unavailable = diagnoseShieldWalletConnectionError(new Error("The wallet is not available"));
  const unknown = diagnoseShieldWalletConnectionError(new Error("internal secret detail"));

  assert.equal(rejected.issue, "AuthorizationRejected");
  assert.equal(network.issue, "NetworkMismatch");
  assert.equal(unavailable.issue, "WalletUnavailable");
  assert.equal(unknown.issue, "Unknown");
  assert.equal(unknown.message.includes("internal secret detail"), false);
});

test("Shield code requests Testnet minimum permission and only polls public transaction IDs", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const diagnostics = readFileSync("lib/shield-wallet-diagnostics.ts", "utf8");
  const combined = `${provider}\n${diagnostics}`;

  assert.match(provider, /WalletDecryptPermission\.NoDecrypt/);
  assert.match(provider, /Network\.TESTNET/);
  assert.match(provider, /@provablehq\/aleo-wallet-adaptor-shield/);
  assert.match(provider, /executeTransaction/);
  assert.equal(combined.includes("console.log"), false);
  assert.equal(combined.includes("localStorage"), false);
  assert.match(provider, /PUBLIC_PENDING_TRANSACTION_STORAGE_KEY/);
  assert.match(provider, /PUBLIC_TRANSACTION_ID_PATTERN/);
});

test("Shield transaction requests use the successful React session instead of a transient adapter flag", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");

  assert.match(provider, /function requireShieldTransactionAdapter/);
  assert.match(provider, /connectionState !== "Connected"/);
  assert.match(provider, /requireShieldTransactionAdapter\(adapterRef\.current, address, connectionState\)/);
  assert.equal(provider.includes("!adapter?.connected || !address"), false);
  assert.equal(provider.includes("Connect Shield before requesting a Protocol-v3 transaction"), false);
});

test("Shield V3 transaction validation derives every public input count from the Edition 4 ABI source", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const protocol = readFileSync("lib/aleo-protocol-v3.ts", "utf8");

  assert.match(provider, /PROTOCOL_V3_PUBLIC_INPUT_COUNTS/);
  assert.match(provider, /preview\.inputs\.length !== PROTOCOL_V3_PUBLIC_INPUT_COUNTS\[preview\.functionName\]/);
  assert.match(protocol, /review_claim_v3: \["field", "field", "u8", "u8", "field", "field"\]/);
  assert.match(protocol, /dispute_claim_v3: \["field", "field", "u8", "u8", "field", "u64", "field"\]/);
  assert.match(protocol, /finalize_rejection_v3: \["field", "field", "address", "u64", "u8", "field"\]/);
});

test("terminal public V3 transaction results poll the matching public Mapping until its state changes", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const workbench = readFileSync("components/protocol-v3-workbench.tsx", "utf8");
  const create = readFileSync("components/aleo-create-bounty-v3-form.tsx", "utf8");

  assert.match(provider, /lastPublicTransactionResult/);
  assert.match(provider, /setProtocolSubmission\(\(current\) => current\?\.publicTransactionId === transactionId/);
  assert.match(provider, /公开 Transaction 已 Confirmed；正在自动重新读取 Mapping/);
  assert.match(workbench, /autoRefreshedProtocolTransactionId/);
  assert.match(workbench, /result\.state !== "confirmed" && result\.state !== "rejected" && result\.state !== "timeout"/);
  assert.match(workbench, /AUTO_MAPPING_REFRESH_ATTEMPTS = 45/);
  assert.match(workbench, /lookupClaim\(\{ background: true \}\)/);
  assert.match(workbench, /claimBundleFingerprint\(updated\) !== startingFingerprint/);
  assert.match(workbench, /window\.setTimeout\(resolve, AUTO_MAPPING_REFRESH_INTERVAL_MS\)/);
  assert.match(workbench, /页面已进入下一状态/);
  assert.match(create, /autoVerifiedCreationTransactionId/);
  assert.match(create, /\/api\/aleo\/v3\/bounties\//);
});
