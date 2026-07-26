import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("dashboard is a single immersive protocol entry", () => {
  const source = readFileSync("components/dashboard.tsx", "utf8");
  const heroSource = readFileSync("components/hero-proof-visual.tsx", "utf8");
  const uiCopySource = readFileSync("lib/i18n/zh.ts", "utf8");
  const combinedSource = `${source}\n${heroSource}\n${uiCopySource}`;

  for (const phrase of [
    "home-immersive",
    "HeroProofVisual",
    "Private Witness · Public Proof",
    "证明漏洞存在",
    "Exploit 保持私密",
    "进入协议",
    "/images/zkbugbounty-protocol-portal.webp",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present on the dashboard`);
  }
  for (const referenceCopy of ["ALEO GILT", "ENTER THE PROTOCOL", ">START<"]) {
    assert.equal(combinedSource.includes(referenceCopy), false, `${referenceCopy} must not be copied from the reference`);
  }
  assert.equal(source.includes("useAppState"), false, "homepage metrics must not use local Demo state");
  for (const removed of [
    "AleoRegistryOverview",
    "AleoDeploymentStatus",
    "Multi-Invariant DemoVault",
    "Architecture Comparison",
    "stack-marquee",
    "<details",
  ]) {
    assert.equal(source.includes(removed), false, `${removed} should not remain on the focused homepage`);
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

test("navigation is compact and keeps Demo roles out of the global header", () => {
  const source = readFileSync("components/navigation.tsx", "utf8");

  for (const phrase of ["site-navigation", "h-[3.75rem]", "mobile-navigation", "WalletConnectionControl", "lg:hidden"]) {
    assert.equal(source.includes(phrase), true, `${phrase} should be present in navigation`);
  }
  for (const forbidden of ["useAppState", "switchActor", "roleDisplayLabels", "<select"]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must stay out of global navigation`);
  }
});
