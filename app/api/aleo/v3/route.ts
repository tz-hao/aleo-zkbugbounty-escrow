import { NextResponse } from "next/server.js";

import { fetchProtocolV3Capability } from "../../../../lib/aleo-protocol-v3.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const protocolV3 = await fetchProtocolV3Capability();
  const status = protocolV3.status === "EndpointUnavailable"
    ? 503
    : protocolV3.status === "ConfigurationError"
      ? 500
      : 200;
  return NextResponse.json(
    { protocolV3 },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Server-side V3 transaction submission is disabled. Use a connected wallet only after Edition 3 and full source-hash upgrade evidence are verified.",
    },
    { status: 405 },
  );
}
