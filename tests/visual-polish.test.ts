import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("dashboard has a premium product-site hero and protocol visual system", () => {
  const source = readFileSync("components/dashboard.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${uiCopySource}`;

  for (const phrase of [
    "professional-site-hero",
    "Proof without disclosure",
    "Exploit 始终密封",
    "协议工作台（Protocol Desk）",
    "私有输入（Private Input）",
    "公开收据（Public Receipt）",
    "披露流程（Disclosure Rail）",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present on the dashboard`);
  }
});

test("global styles expose reusable professional surface primitives", () => {
  const source = readFileSync("app/globals.css", "utf8");

  for (const className of [
    ".professional-site-hero",
    ".surface-card",
    ".surface-card-strong",
    ".page-kicker",
    ".primary-action",
    ".secondary-action",
    ".input-surface",
  ]) {
    assert.equal(source.includes(className), true, `${className} should be defined`);
  }
});

test("navigation presents the product as a polished protocol console", () => {
  const source = readFileSync("components/navigation.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${uiCopySource}`;

  for (const phrase of ["协议控制台", "当前角色", "交互式 Demo"]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present in navigation`);
  }
});
