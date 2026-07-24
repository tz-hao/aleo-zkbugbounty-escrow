import { NextResponse } from "next/server.js";

import {
  fetchOnChainBountyState,
  getAleoBountyRegistryConfig,
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "../../../../../lib/aleo-bounty-registry.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LookupOptions = {
  config?: AleoBountyRegistryConfig | null;
  fetcher?: RegistryFetch;
};

export async function handleAleoBountyLookup(bountyId: string, options: LookupOptions = {}) {
  if (!isAleoFieldLiteral(bountyId)) {
    return { status: 400, body: { error: "Bounty ID must be an Aleo field literal" } };
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
    const bounty = await fetchOnChainBountyState(bountyId, config, options.fetcher);
    if (!bounty) {
      return { status: 404, body: { error: "Bounty was not found in the Aleo Testnet registry" } };
    }
    return { status: 200, body: { bounty } };
  } catch {
    return {
      status: 502,
      body: { error: "Aleo Testnet registry could not be read" },
    };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ bountyId: string }> },
) {
  const { bountyId } = await context.params;
  const result = await handleAleoBountyLookup(bountyId);
  return NextResponse.json(result.body, { status: result.status });
}
