import { NextResponse } from "next/server";

import { ON_CHAIN_TRIAGE_CAPABILITY } from "@/lib/aleo-triage";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ triage: ON_CHAIN_TRIAGE_CAPABILITY });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "On-chain triage is not present in the deployed Aleo Program.",
      triage: ON_CHAIN_TRIAGE_CAPABILITY,
    },
    { status: 409 },
  );
}
