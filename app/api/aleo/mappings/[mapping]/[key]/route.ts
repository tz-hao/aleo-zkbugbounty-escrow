import { NextResponse } from "next/server.js";

import {
  isAleoFieldKey,
  isEditionOneMappingName,
  verifyPublicEditionOneMapping,
} from "../../../../../../lib/testnet-edition-one.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function handleEditionOneMappingLookup(mapping: string, key: string) {
  if (!isEditionOneMappingName(mapping) || !isAleoFieldKey(key)) {
    return { status: 400, body: { error: "Mapping name or Aleo field key is invalid" } };
  }
  const verification = await verifyPublicEditionOneMapping(mapping, key);
  return {
    status: verification.status === "HTTP_ERROR" ? 502 : 200,
    body: { verification },
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ mapping: string; key: string }> },
) {
  const { mapping, key } = await context.params;
  const result = await handleEditionOneMappingLookup(mapping, key);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}