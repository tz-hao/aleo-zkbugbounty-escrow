import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("triage page exposes the required role-aware sections", () => {
  const source = readFileSync("app/triage/page.tsx", "utf8");
  const controlsSource = readFileSync("components/triage-action-controls.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${controlsSource}\n${uiCopySource}`;

  for (const phrase of [
    "Verified Claim 摘要",
    "Proof Receipt",
    "Responsible Disclosure 流程",
    "Triage 时间线",
    "可执行操作",
    "Proof Engine",
    "Claim Hash",
    "Registry Key",
    "Witness Commitment",
    "Nullifier",
    "Protocol Version",
    "安全规则（Rule Name）",
    "Rule ID",
    "受影响模块",
    "Invariant",
    "Impact",
    "Severity",
    "Scope Hash",
    "Claim Receipt 记录公开 Proof Metadata；验证强度以 Verification Level 为准",
    "建议 Severity",
    "加密报告只会分享给 Project Owner。",
    "Exploit 细节不会出现在公开页面中。",
    "公开用户无法访问 Triage 操作。",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} must be present on triage page`);
  }

  assert.equal(source.includes("canViewTriage"), true, "triage page must check role visibility");
  for (const privateTerm of ["privateCallSequence", "privateStateValues", "reporterSecret", "hiddenDelta", "showCommitment"]) {
    assert.equal(source.includes(privateTerm), false, `${privateTerm} must not appear in triage receipt UI`);
  }
});
