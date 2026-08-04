import { NextResponse } from "next/server.js";

import {
  getAleoBountyRegistryConfig,
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "../../../../../lib/aleo-bounty-registry.ts";
import { fetchOnChainClaimReceipt } from "../../../../../lib/aleo-claim-receipt-registry.ts";

export const runtime = "nodejs";

type LookupOptions = {
  config?: AleoBountyRegistryConfig | null;
  fetcher?: RegistryFetch;
};

export async function handleAleoClaimReceiptLookup(
  claimHash: string,
  options: LookupOptions = {},
) {
  if (!isAleoFieldLiteral(claimHash)) {
    return { status: 400, body: { error: "Claim hash must be an Aleo field literal" } };
  }

  let config: AleoBountyRegistryConfig | null;
  try {
    config = options.config === undefined ? getAleoBountyRegistryConfig() : options.config;
  } catch {
    return { status: 503, body: { error: "Aleo registry configuration is invalid" } };
  }
  if (!config) {
    return {
      status: 503,
      body: {
        error: "Aleo Testnet registry is not configured",
        source: "Unconfigured",
      },
    };
  }

  try {
    const receipt = await fetchOnChainClaimReceipt(claimHash, config, options.fetcher);
    if (!receipt) {
      return {
        status: 404,
        body: { error: "Claim receipt was not found in the Aleo Testnet registry" },
      };
    }
    return { status: 200, body: { receipt } };
  } catch {
    return {
      status: 502,
      body: { error: "Aleo Testnet claim receipt could not be read" },
    };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ claimHash: string }> },
) {
  const { claimHash } = await context.params;
  const result = await handleAleoClaimReceiptLookup(claimHash);
  return NextResponse.json(result.body, { status: result.status });
}
