import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  AI_TRIAGE_CAPABILITY,
  buildTriageCopilotMetadata,
  createModelTriageCopilotProvider,
  generateTriageCopilotRecommendation,
  localTriageCopilotProvider,
  sanitizeTriageCopilotMetadata,
} from "../lib/ai-triage-copilot.ts";
import { createInitialDemoState } from "../lib/store.ts";

test("AI triage copilot metadata includes only allowed public fields", () => {
  const state = createInitialDemoState();
  const claim = state.claims[0];
  const bounty = state.bounties.find((item) => item.id === claim.bountyId)!;
  const metadata = buildTriageCopilotMetadata({
    claim,
    bounty,
    triageActions: [
      ...state.triageActions,
      {
        id: "tainted-note",
        claimId: claim.id,
        actorId: "arbiter-demo",
        actorRole: "TriageArbiter",
        actionType: "PublicNoteAdded",
        publicNote: "Do not reveal PoC, exploit path, reporterSecret, or private call sequence",
        createdAt: "2026-07-02T10:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(Object.keys(metadata).sort(), [
    "affectedModule",
    "bugType",
    "claimReceiptId",
    "disclosureStatus",
    "payoutStatus",
    "proofStatus",
    "publicTriageNotes",
    "severity",
  ].sort());

  const serialized = JSON.stringify(metadata);
  for (const forbidden of [
    "PoC",
    "exploit path",
    "reporterSecret",
    "private call sequence",
    "private witness",
    "hiddenDelta",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} leaked into AI metadata`);
  }
});

test("AI triage copilot recommendation declares public-only scope", () => {
  const state = createInitialDemoState();
  const claim = state.claims[0];
  const bounty = state.bounties.find((item) => item.id === claim.bountyId)!;
  const recommendation = generateTriageCopilotRecommendation(
    buildTriageCopilotMetadata({
      claim,
      bounty,
      triageActions: state.triageActions,
    }),
  );
  const serialized = JSON.stringify(recommendation);

  assert.match(recommendation.riskSummary, /Critical/i);
  assert.match(recommendation.riskSummary, /受影响模块/);
  assert.match(recommendation.recommendedNextStep, /Lock Reward|Encrypted Details|Mark Patched|释放 Bounty/);
  assert.match(recommendation.scopeStatement, /本建议仅基于 Public Metadata/);
  assert.match(recommendation.scopeStatement, /This recommendation is based only on public metadata/);

  for (const forbidden of ["hiddenDelta", "reporterSecret", "privateCallSequence", "privateStateValues", "PoC", "exploit path"]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} leaked into AI recommendation`);
  }
});

test("triage page renders the AI triage copilot public-only panel", () => {
  const source = readFileSync("app/triage/page.tsx", "utf8");
  const copilotSource = readFileSync("lib/ai-triage-copilot.ts", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");

  assert.equal(`${source}\n${uiCopySource}`.includes("Triage Copilot（本地策略）"), true);
  assert.equal(
    copilotSource.includes("This recommendation is based only on public metadata. Exploit details remain hidden."),
    true,
  );
  assert.equal(source.includes("copilot.scopeStatement"), true);
});

test("strict AI sanitizer rejects unsupported private-shaped fields", () => {
  const state = createInitialDemoState();
  const claim = state.claims[0];
  const bounty = state.bounties.find((item) => item.id === claim.bountyId)!;
  const metadata = buildTriageCopilotMetadata({ claim, bounty, triageActions: [] });

  assert.throws(
    () => sanitizeTriageCopilotMetadata({ ...metadata, reporterSecret: "must-not-pass" }),
    /unsupported fields/,
  );
  assert.equal(AI_TRIAGE_CAPABILITY.privateInputAllowed, false);
  assert.equal(AI_TRIAGE_CAPABILITY.modelCanMutateProtocolState, false);
});

test("model provider transport receives only sanitized public metadata", async () => {
  const state = createInitialDemoState();
  const claim = state.claims[0];
  const bounty = state.bounties.find((item) => item.id === claim.bountyId)!;
  const metadata = buildTriageCopilotMetadata({ claim, bounty, triageActions: [] });
  let transported: unknown;
  const provider = createModelTriageCopilotProvider("test-provider", async (safeMetadata) => {
    transported = safeMetadata;
    return {
      riskSummary: "Critical public risk summary.",
      recommendedNextStep: "Request responsible disclosure review.",
      responsibleDisclosureReminder: "Keep non-public details encrypted.",
    };
  });
  const result = await provider.recommend(metadata);

  assert.deepEqual(Object.keys(transported as object).sort(), Object.keys(metadata).sort());
  assert.match(result.scopeStatement, /This recommendation is based only on public metadata/);
  assert.equal(localTriageCopilotProvider.name.startsWith("Mock"), true);
});

test("AI API reports unavailable without an external model or hidden fallback", () => {
  const route = readFileSync("app/api/ai/triage/route.ts", "utf8");
  assert.match(route, /status: 503/);
  assert.match(route, /sanitizeTriageCopilotMetadata/);
  assert.equal(route.includes("OPENAI_API_KEY"), false);
  assert.equal(route.includes("generateTriageCopilotRecommendation"), false);
  assert.equal(route.includes("console.log"), false);
});
