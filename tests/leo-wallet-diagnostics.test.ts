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
  const network = diagnoseShieldWalletConnectionError(
    new Error("network testnet mismatch"),
  );
  const unavailable = diagnoseShieldWalletConnectionError(new Error("The wallet is not available"));
  const unknown = diagnoseShieldWalletConnectionError(new Error("internal secret detail"));

  assert.equal(rejected.issue, "AuthorizationRejected");
  assert.equal(network.issue, "NetworkMismatch");
  assert.equal(unavailable.issue, "WalletUnavailable");
  assert.equal(unknown.issue, "Unknown");
  assert.equal(unknown.message.includes("internal secret detail"), false);
});

test("wallet connection code uses Testnet minimum permission and public-only pending polling", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const diagnostics = readFileSync("lib/shield-wallet-diagnostics.ts", "utf8");
  const combined = `${provider}\n${diagnostics}`;

  assert.match(provider, /WalletDecryptPermission\.NoDecrypt/);
  assert.match(provider, /Network\.TESTNET/);
  assert.match(provider, /CANONICAL_ALEO_PROGRAM_ID/);
  assert.equal(combined.includes("console.log"), false);
  assert.equal(combined.includes("localStorage"), false);
  assert.match(provider, /PUBLIC_PENDING_TRANSACTION_STORAGE_KEY/);
  assert.match(provider, /PUBLIC_TRANSACTION_ID_PATTERN/);
  assert.equal(provider.includes("console.log"), false);
});
