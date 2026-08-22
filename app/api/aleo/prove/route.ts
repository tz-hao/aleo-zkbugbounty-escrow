import { NextResponse } from "next/server.js";
import { getDeviceProofCapability } from "../../../../lib/device-proof-boundary.ts";

export const runtime = "nodejs";

const DEVICE_ONLY_ERROR =
  "Server-side private proving is disabled. Use Shield device-side submit_claim_v2.";

export function handleAleoProofRequest() {
  return {
    body: {
      error: DEVICE_ONLY_ERROR,
      privateInputsAccepted: false,
      mode: "shield-wallet-device",
    },
    status: 410,
  } as const;
}

export async function GET() {
  return NextResponse.json(getDeviceProofCapability(), {
    headers: { "cache-control": "no-store" },
  });
}

// Do not read or parse the request body. Real Mode private inputs must never be processed by Next.js.
export async function POST() {
  const result = handleAleoProofRequest();
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
