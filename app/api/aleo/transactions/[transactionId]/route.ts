import { NextResponse } from "next/server.js";

import {
  ALEO_TRANSACTION_ID_PATTERN,
  fetchConfirmedCreateBountyTransaction,
  type TransactionFetch,
} from "../../../../../lib/aleo-create-bounty-acceptance.ts";

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await context.params;
  const result = await handleCreateBountyTransactionLookup(transactionId);
  return NextResponse.json(result.body, { status: result.status });
}
