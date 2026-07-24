import { NextResponse } from "next/server";

import {
  AI_TRIAGE_CAPABILITY,
  sanitizeTriageCopilotMetadata,
} from "@/lib/ai-triage-copilot";
import {
  enforceEphemeralRateLimit,
  rateLimitHeaders,
  readBoundedJson,
} from "@/lib/api-security";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ capability: AI_TRIAGE_CAPABILITY });
}

export async function POST(request: Request) {
  const rateLimit = enforceEphemeralRateLimit(request, {
    namespace: "ai-triage",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many AI triage requests." },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }
  let payload: unknown;
  try {
    payload = await readBoundedJson(request, 16_384);
    sanitizeTriageCopilotMetadata(payload);
  } catch {
    return NextResponse.json(
      { error: "Only the strict public triage metadata schema is accepted." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      error: "External AI provider is not configured.",
      capability: AI_TRIAGE_CAPABILITY,
    },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}
