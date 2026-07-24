import { NextResponse } from "next/server";

import { REWARD_ESCROW_CAPABILITY } from "@/lib/aleo-reward-escrow";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ escrow: REWARD_ESCROW_CAPABILITY });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Reward escrow is not present in the deployed Aleo Program.",
      escrow: REWARD_ESCROW_CAPABILITY,
    },
    { status: 409 },
  );
}
