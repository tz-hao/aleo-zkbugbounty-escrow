import { NextResponse } from "next/server.js";

import {
  getAleoPublicIndexConfig,
  listIndexedBounties,
  listIndexedClaims,
  PUBLIC_INDEX_MAX_PAGE_SIZE,
  type AleoPublicIndexConfig,
} from "../../../../lib/aleo-public-index.ts";
import type { TransactionFetch } from "../../../../lib/aleo-create-bounty-acceptance.ts";
import {
  enforceEphemeralRateLimit,
  rateLimitHeaders,
} from "../../../../lib/api-security.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicIndexKind = "bounties" | "claims";

type IndexOptions = {
  config?: AleoPublicIndexConfig | null;
  fetcher?: TransactionFetch;
};

export async function handleAleoPublicIndex(
  kind: string,
  pageValue: string,
  limitValue: string,
  options: IndexOptions = {},
) {
  if (kind !== "bounties" && kind !== "claims") {
    return { status: 400, body: { error: "Registry kind must be bounties or claims" } };
  }
  const page = Number(pageValue);
  const limit = Number(limitValue);
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > PUBLIC_INDEX_MAX_PAGE_SIZE
  ) {
    return { status: 400, body: { error: "Registry pagination is invalid" } };
  }

  let config: AleoPublicIndexConfig | null;
  try {
    config = options.config === undefined ? getAleoPublicIndexConfig() : options.config;
  } catch {
    return { status: 503, body: { error: "Aleo public index configuration is invalid" } };
  }
  if (!config) {
    return {
      status: 503,
      body: { error: "Aleo public index is not configured", source: "Unavailable" },
    };
  }

  try {
    const registry = kind === "bounties"
      ? await listIndexedBounties(page, limit, config, options.fetcher)
      : await listIndexedClaims(page, limit, config, options.fetcher);
    return { status: 200, body: { registry } };
  } catch {
    return {
      status: 502,
      body: {
        error: "Aleo public transaction index is temporarily unavailable",
        source: "Unavailable",
        fallback: "None",
      },
    };
  }
}

export async function GET(request: Request) {
  const rateLimit = enforceEphemeralRateLimit(request, {
    namespace: "aleo-public-registry",
    limit: 60,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registry requests.", source: "Unavailable", fallback: "None" },
      { status: 429, headers: rateLimitHeaders(rateLimit) },
    );
  }
  const url = new URL(request.url);
  const kind: PublicIndexKind | string = url.searchParams.get("kind") ?? "bounties";
  const result = await handleAleoPublicIndex(
    kind,
    url.searchParams.get("page") ?? "0",
    url.searchParams.get("limit") ?? "10",
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
