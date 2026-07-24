import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  diagnoseLeoWalletConnectionError,
  getInjectedLeoWallet,
  inspectLeoWalletProvider,
} from "../lib/leo-wallet-diagnostics.ts";

test("Leo Wallet provider detection distinguishes missing and compatible injection", () => {
  const provider = { connect() {} };

  assert.equal(getInjectedLeoWallet({}), null);
  assert.equal(getInjectedLeoWallet({ leoWallet: provider }), provider);
  assert.equal(getInjectedLeoWallet({ leo: provider }), provider);
  assert.equal(inspectLeoWalletProvider(null), "Missing");
  assert.equal(inspectLeoWalletProvider({}), "Incompatible");
  assert.equal(inspectLeoWalletProvider(provider), "Ready");
});

test("Leo Wallet connection errors are classified without exposing raw messages", () => {
  const rejected = diagnoseLeoWalletConnectionError(new Error("User rejected request 401"));
  const network = diagnoseLeoWalletConnectionError(
    new Error("InvalidParamsAleoWalletError testnetbeta"),
  );
  const unavailable = diagnoseLeoWalletConnectionError(new Error("The wallet is not available"));
  const unknown = diagnoseLeoWalletConnectionError(new Error("internal secret detail"));

  assert.equal(rejected.issue, "AuthorizationRejected");
  assert.equal(network.issue, "NetworkMismatch");
  assert.equal(unavailable.issue, "WalletUnavailable");
  assert.equal(unknown.issue, "Unknown");
  assert.equal(unknown.message.includes("internal secret detail"), false);
});

test("wallet connection code uses Testnet minimum permission without persistence or logging", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const diagnostics = readFileSync("lib/leo-wallet-diagnostics.ts", "utf8");
  const combined = `${provider}\n${diagnostics}`;

  assert.match(provider, /DecryptPermission\.NoDecrypt/);
  assert.match(provider, /WalletAdapterNetwork\.TestnetBeta/);
  assert.match(provider, /CANONICAL_ALEO_PROGRAM_ID/);
  assert.equal(combined.includes("console.log"), false);
  assert.equal(combined.includes("localStorage"), false);
  assert.equal(combined.includes("sessionStorage"), false);
});
