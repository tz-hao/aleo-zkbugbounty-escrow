import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { enforceEphemeralRateLimit, readBoundedJson } from "../lib/api-security.ts";

test("ephemeral API limiter rejects requests beyond the per-instance policy", () => {
  const request = new Request("https://zkbb.test/api", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  const policy = { namespace: `test-${Date.now()}`, limit: 2, windowMs: 60_000 };
  assert.equal(enforceEphemeralRateLimit(request, policy, 1_000).allowed, true);
  assert.equal(enforceEphemeralRateLimit(request, policy, 1_001).allowed, true);
  const blocked = enforceEphemeralRateLimit(request, policy, 1_002);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test("bounded JSON parser accepts small public payloads and rejects oversized bodies", async () => {
  const accepted = await readBoundedJson(
    new Request("https://zkbb.test/api", { method: "POST", body: JSON.stringify({ public: true }) }),
    128,
  );
  assert.deepEqual(accepted, { public: true });
  await assert.rejects(
    readBoundedJson(
      new Request("https://zkbb.test/api", { method: "POST", body: JSON.stringify({ value: "x".repeat(256) }) }),
      64,
    ),
    /exceeds/,
  );
});

test("Next config defines CSP and wallet-compatible security headers", () => {
  const config = readFileSync("next.config.ts", "utf8");
  for (const expected of [
    "Content-Security-Policy",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "X-Content-Type-Options",
    "same-origin-allow-popups",
    "Permissions-Policy",
    "https://api.explorer.provable.com",
    "https://testnetbeta.aleorpc.com",
  ]) {
    assert.equal(config.includes(expected), true, `${expected} security boundary missing`);
  }
});

test("App error boundary never renders raw exception details", () => {
  const boundary = readFileSync("app/error.tsx", "utf8");
  assert.equal(boundary.includes("error.message"), false);
  assert.equal(boundary.includes("error.stack"), false);
  assert.equal(boundary.includes("console."), false);
  assert.match(boundary, /reset/);
});

test("AI and registry routes apply bounded input or rate limiting", () => {
  const ai = readFileSync("app/api/ai/triage/route.ts", "utf8");
  const registry = readFileSync("app/api/aleo/registry/route.ts", "utf8");
  assert.match(ai, /readBoundedJson\(request, 16_384\)/);
  assert.match(ai, /status: 429/);
  assert.match(registry, /status: 429/);
  assert.match(registry, /fallback: "None"/);
});
