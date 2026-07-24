import { createHash } from "node:crypto";

type RateLimitEntry = { count: number; resetAt: number };

type RateLimitStore = Map<string, RateLimitEntry>;

const globalRateLimit = globalThis as typeof globalThis & {
  __zkbbRateLimitStore?: RateLimitStore;
};

const rateLimitStore = globalRateLimit.__zkbbRateLimitStore ?? new Map<string, RateLimitEntry>();
if (process.env.NODE_ENV !== "production") globalRateLimit.__zkbbRateLimitStore = rateLimitStore;

export type RateLimitPolicy = {
  namespace: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

function requestFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "anonymous";
  return createHash("sha256").update(address.slice(0, 128)).digest("hex").slice(0, 24);
}

export function enforceEphemeralRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  now = Date.now(),
): RateLimitResult {
  if (rateLimitStore.size > 2_000) {
    for (const [key, value] of rateLimitStore) {
      if (value.resetAt <= now) rateLimitStore.delete(key);
    }
  }
  const key = `${policy.namespace}:${requestFingerprint(request)}`;
  const existing = rateLimitStore.get(key);
  const entry = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + policy.windowMs }
    : existing;
  entry.count += 1;
  rateLimitStore.set(key, entry);
  return {
    allowed: entry.count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "cache-control": "no-store",
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "retry-after": String(result.retryAfterSeconds),
  };
}

export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Request body exceeds the configured limit");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error("Request body exceeds the configured limit");
  }
  return JSON.parse(text);
}
