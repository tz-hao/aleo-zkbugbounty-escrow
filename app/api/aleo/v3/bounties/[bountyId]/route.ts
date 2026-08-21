import { NextResponse } from "next/server.js";

import {
  getAleoBountyRegistryConfig,
  isAleoFieldLiteral,
  fetchOnChainBountyState,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "../../../../../../lib/aleo-bounty-registry.ts";
import {
  fetchOnChainBountyClaimCount,
  fetchOnChainBountyEscrow,
  fetchOnChainBountyProtocolVersion,
} from "../../../../../../lib/aleo-escrow-registry.ts";
import {
  fetchProtocolV3Capability,
  type ProtocolV3Capability,
} from "../../../../../../lib/aleo-protocol-v3.ts";
import { fetchOnChainBountyV3Config } from "../../../../../../lib/aleo-v3-registry.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LookupOptions = {
  config?: AleoBountyRegistryConfig | null;
  fetcher?: RegistryFetch;
  capability?: ProtocolV3Capability;
};

function unavailable(capability: ProtocolV3Capability) {
  return {
    status: capability.status === "EndpointUnavailable"
      ? 503
      : capability.status === "ConfigurationError"
        ? 500
        : 409,
    body: {
      error: "Protocol V3 public state is unavailable until the required Program Edition and its public evidence are verified",
      capability: capability.status,
    },
  };
}

export async function handleProtocolV3BountyLookup(
  bountyId: string,
  options: LookupOptions = {},
) {
  if (!isAleoFieldLiteral(bountyId)) {
    return { status: 400, body: { error: "Bounty ID must be an Aleo field literal" } };
  }
  const capability = options.capability ??
    await fetchProtocolV3Capability(options.fetcher);
  if (capability.status !== "Available") return unavailable(capability);

  let config: AleoBountyRegistryConfig | null;
  try {
    config = options.config === undefined
      ? getAleoBountyRegistryConfig()
      : options.config;
  } catch {
    return { status: 503, body: { error: "Aleo registry configuration is invalid" } };
  }
  if (!config) {
    return { status: 503, body: { error: "Aleo Testnet registry is not configured" } };
  }

  try {
    const [bounty, policy, escrow, protocolVersion, unresolvedClaimCount] =
      await Promise.all([
        fetchOnChainBountyState(bountyId, config, options.fetcher),
        fetchOnChainBountyV3Config(bountyId, config, options.fetcher),
        fetchOnChainBountyEscrow(bountyId, config, options.fetcher),
        fetchOnChainBountyProtocolVersion(bountyId, config, options.fetcher),
        fetchOnChainBountyClaimCount(bountyId, config, options.fetcher),
      ]);
    if (!bounty || !policy || protocolVersion !== 3) {
      return {
        status: 404,
        body: { error: "Protocol-v3 Bounty was not found on Aleo Testnet" },
      };
    }
    return {
      status: 200,
      body: { bounty, policy, escrow, protocolVersion, unresolvedClaimCount },
    };
  } catch {
    return {
      status: 502,
      body: { error: "Aleo Testnet Protocol-v3 Bounty state could not be read" },
    };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ bountyId: string }> },
) {
  const { bountyId } = await context.params;
  const result = await handleProtocolV3BountyLookup(bountyId);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
