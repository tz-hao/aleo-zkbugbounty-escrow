import { NextResponse } from "next/server.js";

import {
  ALEO_TRANSACTION_ID_PATTERN,
  fetchConfirmedCreateBountyTransaction,
  type TransactionFetch,
} from "../../../../../lib/aleo-create-bounty-acceptance.ts";
import { ALEO_TESTNET_API_ENDPOINT } from "../../../../../lib/aleo-program.ts";
import { sanitizeRejectionSummary } from "../../../../../lib/aleo-transaction-status.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function handleCreateBountyTransactionLookup(
  transactionId: string,
  fetcher?: TransactionFetch,
) {
  if (!ALEO_TRANSACTION_ID_PATTERN.test(transactionId)) {
    return { status: 400, body: { error: "Transaction ID must be an Aleo transaction ID" } };
  }
  try {
    const transaction = await fetchConfirmedCreateBountyTransaction(transactionId, fetcher);
    if (!transaction) {
      return {
        status: 404,
        body: {
          error: "Transaction is not confirmed on Aleo Testnet",
          transactionStatus: "PendingOrUnknown",
        },
      };
    }
    return { status: 200, body: { transaction } };
  } catch {
    return {
      status: 502,
      body: {
        error: "Aleo Testnet transaction could not be verified",
        transactionStatus: "Unavailable",
      },
    };
  }
}

export async function handlePublicTransactionStatusLookup(
  transactionId: string,
  fetcher: TransactionFetch = fetch,
) {
  if (!ALEO_TRANSACTION_ID_PATTERN.test(transactionId)) {
    return { status: 400, body: { error: "Transaction ID must be an Aleo transaction ID" } };
  }
  try {
    const response = await fetcher(
      ALEO_TESTNET_API_ENDPOINT + "/testnet/transaction/confirmed/" + encodeURIComponent(transactionId),
      {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (response.status === 404) {
      return {
        status: 200,
        body: { transactionId, transactionStatus: "pending", indexStatus: "not_indexed_yet" },
      };
    }
    if (!response.ok) {
      return {
        status: 502,
        body: { transactionId, transactionStatus: "unavailable", indexStatus: "http_error" },
      };
    }
    const payload = await response.json().catch(() => null) as {
      status?: unknown;
      transaction?: { status?: unknown };
      rejection_reason?: unknown;
    } | null;
    const observedStatus = String(payload?.status ?? payload?.transaction?.status ?? "accepted").toLowerCase();
    if (observedStatus === "rejected" || observedStatus === "aborted" || observedStatus === "failed") {
      return {
        status: 200,
        body: {
          transactionId,
          transactionStatus: "rejected",
          rejectionSummary: sanitizeRejectionSummary(payload?.rejection_reason),
        },
      };
    }
    return {
      status: 200,
      body: { transactionId, transactionStatus: "confirmed", indexStatus: "found" },
    };
  } catch {
    return {
      status: 502,
      body: { transactionId, transactionStatus: "unavailable", indexStatus: "http_error" },
    };
  }
}

export async function handleTransactionLookupRequest(
  transactionId: string,
  intent: string | null,
  fetcher: TransactionFetch = fetch,
) {
  if (intent === "create_bounty") {
    return handleCreateBountyTransactionLookup(transactionId, fetcher);
  }
  return handlePublicTransactionStatusLookup(transactionId, fetcher);
}
export async function GET(
  request: Request,
  context: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await context.params;
  const intent = new URL(request.url).searchParams.get("intent");
  const result = await handleTransactionLookupRequest(transactionId, intent);
  return NextResponse.json(result.body, { status: result.status });
}
