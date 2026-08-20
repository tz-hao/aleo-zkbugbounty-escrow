import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPublicTransactionLookup,
  classifyWalletTransactionFailure,
  isTransactionSubmissionBlocked,
  pollPublicTransaction,
  transactionFeedback,
} from "../lib/aleo-transaction-status.ts";

test("wallet transaction states keep disconnected, wrong network, and signature rejection explicit", () => {
  assert.equal(transactionFeedback("wallet_disconnected").code, "WALLET_DISCONNECTED");
  assert.equal(transactionFeedback("wrong_network").code, "WRONG_NETWORK");
  assert.equal(classifyWalletTransactionFailure(new Error("user rejected request")).state, "signature_rejected");
  assert.equal(classifyWalletTransactionFailure(new Error("testnet chain mismatch")).state, "wrong_network");
  const unknown = classifyWalletTransactionFailure(new Error("rpc 500"));
  assert.equal(unknown.state, "failed");
  assert.equal(unknown.code, "WALLET_REQUEST_FAILED");
  assert.match(unknown.advice, /Public Credits/);
});

test("transaction lookup does not turn indexing 404 or endpoint errors into rejected", () => {
  assert.equal(classifyPublicTransactionLookup({ httpStatus: 404 }).state, "pending");
  assert.equal(classifyPublicTransactionLookup({ httpStatus: 404 }).indexStatus, "not_indexed_yet");
  assert.equal(classifyPublicTransactionLookup({ httpStatus: 501 }).indexStatus, "endpoint_not_supported");
  assert.equal(classifyPublicTransactionLookup({ httpStatus: 500 }).state, "pending");
  const rejected = classifyPublicTransactionLookup({
    httpStatus: 200,
    status: "rejected",
    rejectionReason: "sign1not-for-ui",
  });
  assert.equal(rejected.state, "rejected");
  assert.equal(rejected.rejectionSummary?.includes("sign1not-for-ui"), false);
});

test("public transaction polling reaches pending, accepted, then confirmed without duplicate timers", async () => {
  const updates: string[] = [];
  const attempts: number[] = [];
  const sleeps: number[] = [];
  const result = await pollPublicTransaction({
    maxAttempts: 4,
    intervalMs: 1,
    lookup: async (attempt) => {
      attempts.push(attempt);
      return attempt === 1
        ? { httpStatus: 404 }
        : attempt === 2
          ? { httpStatus: 200, status: "accepted" }
          : { httpStatus: 200, status: "confirmed" };
    },
    onUpdate: (feedback) => updates.push(feedback.state),
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
  });
  assert.deepEqual(attempts, [1, 2, 3]);
  assert.deepEqual(sleeps, [1, 1]);
  assert.deepEqual(updates, ["pending", "accepted", "confirmed"]);
  assert.equal(result.state, "confirmed");
});

test("polling has a bounded timeout and in-flight states block duplicate submission", async () => {
  const result = await pollPublicTransaction({
    maxAttempts: 2,
    lookup: async () => ({ httpStatus: 404 }),
    sleep: async () => undefined,
  });
  assert.equal(result.state, "timeout");
  assert.equal(result.indexStatus, "not_found_after_timeout");
  for (const state of ["awaiting_signature", "generating_transaction", "broadcasting", "pending", "accepted"] as const) {
    assert.equal(isTransactionSubmissionBlocked(state), true);
  }
  assert.equal(isTransactionSubmissionBlocked("confirmed"), false);
  assert.equal(isTransactionSubmissionBlocked("signature_rejected"), false);
});
