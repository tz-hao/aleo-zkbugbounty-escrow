import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("triage page exposes the required role-aware sections", () => {
  const source = readFileSync("app/triage/page.tsx", "utf8");
  const controlsSource = readFileSync("components/triage-action-controls.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${controlsSource}\n${uiCopySource}`;

  for (const phrase of [
    "已验证声明摘要",
    "证明收据",
    "负责任披露流程",
    "分诊时间线",
    "可执行操作",
    "证明引擎",
    "声明哈希",
    "注册表键",
    "见证承诺",
    "防重复标识",
    "协议版本",
    "安全规则",
    "规则编号",
    "受影响模块",
    "安全不变量",
    "影响区间",
    "严重程度",
    "范围哈希",
    "声明收据记录公开证明元数据；验证强度以验证级别为准",
    "建议严重程度",
    "加密报告只会分享给项目方。",
    "利用细节不会出现在公开页面中。",
    "公开用户无法访问漏洞分诊操作。",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} must be present on triage page`);
  }

  assert.equal(source.includes("canViewTriage"), true, "triage page must check role visibility");
  for (const privateTerm of ["privateCallSequence", "privateStateValues", "reporterSecret", "hiddenDelta", "showCommitment"]) {
    assert.equal(source.includes(privateTerm), false, `${privateTerm} must not appear in triage receipt UI`);
  }
});
