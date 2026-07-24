import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyWalletResponseId,
  normalizeWalletTransactionStatus,
  WALLET_COMPATIBILITY,
} from "../lib/wallet-compatibility.ts";
import { diagnoseLeoWalletTransactionError } from "../lib/leo-wallet-diagnostics.ts";

test("only Leo Wallet is represented as formally verified", () => {
  const verified = WALLET_COMPATIBILITY.filter((wallet) => wallet.verification === "Verified");
  assert.deepEqual(verified.map((wallet) => wallet.name), ["Leo Wallet"]);
  assert.equal(verified[0].walletChainId, "testnetbeta");
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
    diagnoseLeoWalletTransactionError(new Error("network testnet mismatch")).issue,
    "NetworkMismatch",
  );
  assert.equal(
    diagnoseLeoWalletTransactionError(new Error("wallet locked")).issue,
    "WalletLocked",
  );
  const rejected = diagnoseLeoWalletTransactionError(new Error("user rejected secret payload"));
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
  assert.match(provider, /WalletAdapterNetwork\.TestnetBeta/);
  assert.match(provider, /feeMicrocredits/);
  assert.match(control, /Leo Wallet/);
  assert.match(control, /Verified/);
  assert.match(control, /Mobile Wallet 未验证/);
  assert.match(control, /min-w-0/);
});
