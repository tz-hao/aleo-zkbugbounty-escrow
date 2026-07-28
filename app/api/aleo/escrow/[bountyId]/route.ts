import { NextResponse } from "next/server.js";

import {
  getAleoBountyRegistryConfig,
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "../../../../../lib/aleo-bounty-registry.ts";
import {
  fetchOnChainBountyClaimCount,
  fetchOnChainBountyEscrow,
  fetchOnChainBountyProtocolVersion,
} from "../../../../../lib/aleo-escrow-registry.ts";
import {
  fetchRewardEscrowCapability,
  type RewardEscrowCapability,
} from "../../../../../lib/aleo-reward-escrow.ts";

export const runtime = "nodejs";

type LookupOptions = {
  config?: AleoBountyRegistryConfig | null;
  fetcher?: RegistryFetch;
  capability?: RewardEscrowCapability;
};

function unavailableCapability(capability: RewardEscrowCapability) {
  const status = capability.status === "EndpointUnavailable"
    ? 503
    : capability.status === "ConfigurationError"
      ? 500
      : 409;
  return {
    status,
    body: {
      error: capability.status === "ProgramUpgradeRequired"
        ? "Reward Escrow has not been activated in the deployed Aleo Program"
        : "Reward Escrow capability could not be verified",
      capability: capability.status,
    },
  };
}

export async function handleAleoBountyEscrowLookup(
  bountyId: string,
  options: LookupOptions = {},
) {
  if (!isAleoFieldLiteral(bountyId)) {
    return { status: 400, body: { error: "Bounty ID must be an Aleo field literal" } };
  }
  const capability = options.capability ??
    await fetchRewardEscrowCapability(options.fetcher);
  if (capability.status !== "Available") return unavailableCapability(capability);

  let config: AleoBountyRegistryConfig | null;
  try {
    config = options.config === undefined ? getAleoBountyRegistryConfig() : options.config;
  } catch {
    return { status: 503, body: { error: "Aleo registry configuration is invalid" } };
  }
  if (!config) {
    return { status: 503, body: { error: "Aleo Testnet registry is not configured" } };
  }

  try {
    const [escrow, protocolVersion, unresolvedClaimCount] = await Promise.all([
      fetchOnChainBountyEscrow(bountyId, config, options.fetcher),
      fetchOnChainBountyProtocolVersion(bountyId, config, options.fetcher),
      fetchOnChainBountyClaimCount(bountyId, config, options.fetcher),
    ]);
    return protocolVersion !== 2
      ? {
          status: 404,
          body: { error: "Protocol-v2 Bounty was not found on Aleo Testnet" },
        }
      : {
          status: 200,
          body: { escrow, protocolVersion, unresolvedClaimCount },
        };
  } catch {
    return { status: 502, body: { error: "Aleo Testnet Bounty Escrow could not be read" } };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ bountyId: string }> },
) {
  const { bountyId } = await context.params;
  const result = await handleAleoBountyEscrowLookup(bountyId);
  return NextResponse.json(result.body, { status: result.status });
}
