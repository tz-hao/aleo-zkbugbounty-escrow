import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("public claims page source does not render forbidden private exploit terms", () => {
  const source = readFileSync("app/public-claims/page.tsx", "utf8");
  const forbiddenTerms = [
    "hidden_delta_balance",
    "hidden_delta_claims",
    "triggering parameters",
    "PoC",
    "exploit path",
    "hiddenDelta",
    "reporterSecret",
    "privateCallSequence",
    "privateStateValues",
  ];

  for (const term of forbiddenTerms) {
    assert.equal(source.includes(term), false, `${term} must not appear in public UI source`);
  }
});

test("public claims page shows only public verification and disclosure guarantees", () => {
  const source = readFileSync("app/public-claims/page.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${uiCopySource}`;

  for (const phrase of [
    "Exploit Details: Hidden",
    "Private Proof Data: Never Stored",
    "Verification Level: Explicit",
    "Responsible Disclosure:",
    "公开 Receipt 不等于公开 Exploit",
    "AleoPublicIndex",
    "AleoBountyRegistryPanel",
    "AleoClaimReceiptPanel",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} must be visible on public claims page`);
  }

  assert.equal(source.includes("<button"), false, "public claims page must not define action buttons");
  assert.equal(source.includes("ClaimCard"), false, "public claims page must not render triage/internal claim details");
});
