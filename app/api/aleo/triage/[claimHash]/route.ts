import { NextResponse } from "next/server.js";

import {
  getAleoBountyRegistryConfig,
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "../../../../../lib/aleo-bounty-registry.ts";
import {
  fetchOnChainClaimPayout,
  fetchOnChainClaimReporter,
  fetchOnChainClaimTriage,
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

export async function handleAleoClaimTriageLookup(
  claimHash: string,
  options: LookupOptions = {},
) {
  if (!isAleoFieldLiteral(claimHash)) {
    return { status: 400, body: { error: "Claim Hash must be an Aleo field literal" } };
  }
  const capability = options.capability ??
    await fetchRewardEscrowCapability(options.fetcher);
  if (capability.status !== "Available") {
    const status = capability.status === "EndpointUnavailable"
      ? 503
      : capability.status === "ConfigurationError"
        ? 500
        : 409;
    return {
      status,
      body: {
        error: capability.status === "ProgramUpgradeRequired"
          ? "On-chain Triage has not been activated in the deployed Aleo Program"
          : "On-chain Triage capability could not be verified",
        capability: capability.status,
      },
    };
  }

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
    const [payout, triage, reporterAddress] = await Promise.all([
      fetchOnChainClaimPayout(claimHash, config, options.fetcher),
      fetchOnChainClaimTriage(claimHash, config, options.fetcher),
      fetchOnChainClaimReporter(claimHash, config, options.fetcher),
    ]);
    if (!payout && !triage && !reporterAddress) {
      return { status: 404, body: { error: "Claim Triage state was not found on Aleo Testnet" } };
    }
    return { status: 200, body: { payout, triage, reporterAddress } };
  } catch {
    return { status: 502, body: { error: "Aleo Testnet Claim Triage state could not be read" } };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ claimHash: string }> },
) {
  const { claimHash } = await context.params;
  const result = await handleAleoClaimTriageLookup(claimHash);
  return NextResponse.json(result.body, { status: result.status });
}
