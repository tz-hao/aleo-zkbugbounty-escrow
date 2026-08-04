import { NextResponse } from "next/server";

import { ON_CHAIN_TRIAGE_CAPABILITY } from "@/lib/aleo-triage";
import { fetchRewardEscrowCapability } from "@/lib/aleo-reward-escrow";

export const dynamic = "force-dynamic";

export async function GET() {
  const escrow = await fetchRewardEscrowCapability();
  const triage = {
    ...ON_CHAIN_TRIAGE_CAPABILITY,
    status: escrow.status,
    walletActionsEnabled: escrow.status === "Available",
  };
  const status = escrow.status === "EndpointUnavailable"
    ? 503
    : escrow.status === "ConfigurationError"
      ? 500
      : 200;
  return NextResponse.json({ triage }, { status });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Server-side Aleo transaction submission is disabled. Use a connected wallet after capability verification.",
      triage: ON_CHAIN_TRIAGE_CAPABILITY,
    },
    { status: 405 },
  );
}
