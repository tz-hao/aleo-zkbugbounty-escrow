import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("dashboard prioritizes the real registry and a concise protocol boundary", () => {
  const source = readFileSync("components/dashboard.tsx", "utf8");
  const heroSource = readFileSync("components/hero-proof-visual.tsx", "utf8");
  const combinedSource = `${source}\n${heroSource}`;

  for (const phrase of [
    "professional-site-hero",
    "AleoRegistryOverview",
    "HeroProofVisual",
    "链上事实，而不是本地计数",
    "Private input",
    "Public receipt",
    "Aleo Program Mappings",
    "协议执行路径",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present on the dashboard`);
  }
  assert.equal(source.includes("useAppState"), false, "homepage metrics must not use local Demo state");
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

  for (const phrase of ["h-[3.75rem]", "mobile-navigation", "WalletConnectionControl", "lg:hidden"]) {
    assert.equal(source.includes(phrase), true, `${phrase} should be present in navigation`);
  }
  for (const forbidden of ["useAppState", "switchActor", "roleDisplayLabels", "<select"]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must stay out of global navigation`);
  }
});
