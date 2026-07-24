import { NextResponse } from "next/server.js";

import {
  getAleoBountyRegistryConfig,
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "../../../../../lib/aleo-bounty-registry.ts";
import { fetchOnChainNullifierState } from "../../../../../lib/aleo-nullifier-registry.ts";

export const runtime = "nodejs";

type LookupOptions = {
  config?: AleoBountyRegistryConfig | null;
  fetcher?: RegistryFetch;
};

export async function handleAleoNullifierLookup(
  nullifier: string,
  options: LookupOptions = {},
) {
  if (!isAleoFieldLiteral(nullifier)) {
    return { status: 400, body: { error: "Nullifier must be an Aleo field literal" } };
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
    const state = await fetchOnChainNullifierState(nullifier, config, options.fetcher);
    if (!state) {
      return {
        status: 404,
        body: { error: "Nullifier was not found in the Aleo Testnet registry" },
      };
    }
    return { status: 200, body: { nullifier: state } };
  } catch {
    return {
      status: 502,
      body: { error: "Aleo Testnet nullifier registry could not be read" },
    };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ nullifier: string }> },
) {
  const { nullifier } = await context.params;
  const result = await handleAleoNullifierLookup(nullifier);
  return NextResponse.json(result.body, { status: result.status });
}
