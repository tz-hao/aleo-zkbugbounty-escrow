import { NextResponse } from "next/server.js";

import {
  fetchOnChainBountyState,
  getAleoBountyRegistryConfig,
  isAleoFieldLiteral,
  type AleoBountyRegistryConfig,
  type RegistryFetch,
} from "../../../../../../lib/aleo-bounty-registry.ts";
import { fetchOnChainClaimReceipt } from "../../../../../../lib/aleo-claim-receipt-registry.ts";
import { fetchOnChainClaimReporter } from "../../../../../../lib/aleo-escrow-registry.ts";
import {
  fetchProtocolV3Capability,
  type ProtocolV3Capability,
} from "../../../../../../lib/aleo-protocol-v3.ts";
import {
  fetchOnChainBountyV3Config,
  fetchOnChainClaimV3Acknowledgement,
  fetchOnChainClaimV3ArbitrationTally,
  fetchOnChainClaimV3DisputeBond,
  fetchOnChainClaimV3Evidence,
  fetchOnChainClaimV3Payout,
  fetchOnChainClaimV3State,
} from "../../../../../../lib/aleo-v3-registry.ts";

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
      error: "Protocol V3 public state is unavailable until Edition 2 and its public upgrade evidence are verified",
      capability: capability.status,
    },
  };
}

export async function handleProtocolV3ClaimLookup(
  claimHash: string,
  options: LookupOptions = {},
) {
  if (!isAleoFieldLiteral(claimHash)) {
    return { status: 400, body: { error: "Claim hash must be an Aleo field literal" } };
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
    const [
      receipt,
      reporter,
      evidence,
      state,
      payout,
      tally,
      acknowledgement,
      disputeBond,
    ] = await Promise.all([
      fetchOnChainClaimReceipt(claimHash, config, options.fetcher),
      fetchOnChainClaimReporter(claimHash, config, options.fetcher),
      fetchOnChainClaimV3Evidence(claimHash, config, options.fetcher),
      fetchOnChainClaimV3State(claimHash, config, options.fetcher),
      fetchOnChainClaimV3Payout(claimHash, config, options.fetcher),
      fetchOnChainClaimV3ArbitrationTally(claimHash, config, options.fetcher),
      fetchOnChainClaimV3Acknowledgement(claimHash, config, options.fetcher),
      fetchOnChainClaimV3DisputeBond(claimHash, config, options.fetcher),
    ]);
    if (
      !receipt ||
      receipt.protocolVersion !== 3 ||
      !reporter ||
      !evidence ||
      !state
    ) {
      return {
        status: 404,
        body: { error: "Protocol-v3 Claim was not found on Aleo Testnet" },
      };
    }
    const [bounty, policy] = await Promise.all([
      fetchOnChainBountyState(receipt.bountyId, config, options.fetcher),
      fetchOnChainBountyV3Config(receipt.bountyId, config, options.fetcher),
    ]);
    if (!bounty || !policy || state.bountyId !== receipt.bountyId) {
      return {
        status: 502,
        body: { error: "Protocol-v3 Claim references inconsistent public state" },
      };
    }
    return {
      status: 200,
      body: {
        bounty,
        policy,
        receipt,
        reporter,
        evidence,
        state,
        payout,
        tally,
        acknowledgement,
        disputeBond,
      },
    };
  } catch {
    return {
      status: 502,
      body: { error: "Aleo Testnet Protocol-v3 Claim state could not be read" },
    };
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ claimHash: string }> },
) {
  const { claimHash } = await context.params;
  const result = await handleProtocolV3ClaimLookup(claimHash);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
