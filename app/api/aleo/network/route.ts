import { NextResponse } from "next/server.js";

import {
  fetchAleoTestnetStatus,
  type AleoNetworkFetch,
} from "../../../../lib/aleo-network.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function handleAleoNetworkStatus(fetcher?: AleoNetworkFetch) {
  try {
    const network = await fetchAleoTestnetStatus(fetcher);
    return { status: 200, body: { network } };
  } catch {
    return {
      status: 502,
      body: {
        error: "Aleo Testnet public endpoint is unavailable",
        network: "testnet",
        statusText: "Unavailable",
      },
    };
  }
}

export async function GET() {
  const result = await handleAleoNetworkStatus();
  return NextResponse.json(result.body, { status: result.status });
}
