import { NextResponse } from "next/server";

import { fetchRewardEscrowCapability } from "@/lib/aleo-reward-escrow";

export const dynamic = "force-dynamic";

export async function GET() {
  const escrow = await fetchRewardEscrowCapability();
  const status = escrow.status === "EndpointUnavailable"
    ? 503
    : escrow.status === "ConfigurationError"
      ? 500
      : 200;
  return NextResponse.json({ escrow }, { status });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Server-side Aleo transaction submission is disabled. Use a connected wallet after capability verification.",
    },
    { status: 405 },
  );
}
