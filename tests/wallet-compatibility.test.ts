import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyWalletResponseId,
  normalizeWalletTransactionStatus,
  WALLET_COMPATIBILITY,
} from "../lib/wallet-compatibility.ts";
import { diagnoseShieldWalletTransactionError } from "../lib/shield-wallet-diagnostics.ts";

test("Shield is the only supported wallet and is labelled as an adapter integration", () => {
  assert.deepEqual(WALLET_COMPATIBILITY.map((wallet) => wallet.name), ["Shield Wallet", "Other Aleo wallets"]);
  assert.equal(WALLET_COMPATIBILITY[0].verification, "Experimental");
  assert.equal(WALLET_COMPATIBILITY[0].walletChainId, "testnet");
  assert.equal(WALLET_COMPATIBILITY[1].verification, "NotVerified");
});

test("wallet response ID is not confused with a public transaction ID", () => {
  const request = classifyWalletResponseId("wallet-request-123");
  const transactionId = `at1${"a".repeat(58)}`;
  const transaction = classifyWalletResponseId(transactionId);

  assert.equal(request?.walletRequestId, "wallet-request-123");
  assert.equal(request?.publicTransactionId, null);
  assert.equal(transaction?.publicTransactionId, transactionId);
  assert.equal(classifyWalletResponseId(""), null);
});

test("wallet transaction statuses are normalized conservatively", () => {
  assert.equal(normalizeWalletTransactionStatus("Finalized"), "Finalized");
  assert.equal(normalizeWalletTransactionStatus("Rejected"), "Failed");
  assert.equal(normalizeWalletTransactionStatus("Aborted"), "Failed");
  assert.equal(normalizeWalletTransactionStatus("Pending"), "Processing");
  assert.equal(normalizeWalletTransactionStatus(undefined), "Processing");
});

test("transaction diagnostics cover wrong network, locked wallet, and rejected signature", () => {
  assert.equal(
    diagnoseShieldWalletTransactionError(new Error("network testnet mismatch")).issue,
    "NetworkMismatch",
  );
  assert.equal(
    diagnoseShieldWalletTransactionError(new Error("wallet locked")).issue,
    "WalletLocked",
  );
  const rejected = diagnoseShieldWalletTransactionError(new Error("user rejected secret payload"));
  assert.equal(rejected.issue, "SignatureRejected");
  assert.equal(rejected.message.includes("secret payload"), false);
});

test("wallet provider clears request state on extension disconnect and keeps public fee boundary", () => {
  const provider = readFileSync("components/aleo-wallet-provider.tsx", "utf8");
  const control = readFileSync("components/wallet-connection-control.tsx", "utf8");

  const disconnectHandler = provider.slice(
    provider.indexOf("const handleDisconnect"),
    provider.indexOf("void import", provider.indexOf("const handleDisconnect")),
  );
  assert.match(disconnectHandler, /setSubmission\(null\)/);
  assert.match(disconnectHandler, /setClaimSubmission\(null\)/);
  assert.match(provider, /Network\.TESTNET/);
  assert.match(provider, /executeTransaction/);
  assert.match(provider, /feeMicrocredits/);
  assert.match(control, /Shield/);
  assert.match(control, /Shield connected/);
  assert.match(control, /Expected network/);
  assert.match(control, /<details/);
  assert.match(control, /min-w-0/);
});
