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
    "零知识负责任披露协议",
    "证明漏洞，不泄露利用细节。",
    "进入协议",
    "/images/zkbugbounty-crystal-shield-hero.png",
    "/images/aleo-gilt-header-brand.png",
    "ALEO GILT",
  ]) {
    assert.equal(combinedSource.includes(phrase), true, `${phrase} should be present on the dashboard`);
  }
  assert.equal(source.includes("home-protocol-slogan"), false, "removed hero slogan must not remain on the homepage");
  for (const removedCoverMetadata of ["Aleo Testnet · Network confirmed", "zkbugbounty_7f3c92.aleo"]) {
    assert.equal(source.includes(removedCoverMetadata), false, `${removedCoverMetadata} must not appear on the homepage cover`);
  }
  for (const referenceCopy of ["ENTER THE PROTOCOL", ">START<"]) {
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
  assert.equal(source.includes("home-immersive-mark"), false, "homepage corner icon must not remain");
  for (const homepageNavigation of [
    "home-immersive-top",
    "WalletConnectionControl",
    "LanguageSwitcher",
  ]) {
    assert.equal(source.includes(homepageNavigation), true, `${homepageNavigation} should be present in the homepage navigation`);
  }
  for (const removedNavigation of [
    "copy.navigation.createBounty",
    "copy.navigation.submitProof",
    "copy.navigation.publicClaims",
    "home-desktop-nav",
    "home-mobile-nav",
  ]) {
    assert.equal(source.includes(removedNavigation), false, `${removedNavigation} should not remain in the homepage header`);
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

test("navigation stays off the immersive homepage and keeps Demo roles out of the global header", () => {
  const source = readFileSync("components/navigation.tsx", "utf8");

  for (const phrase of ["site-navigation", "pathname === \"/\"", "return null", "h-[3.75rem]", "mobile-navigation", "WalletConnectionControl", "lg:hidden"]) {
    assert.equal(source.includes(phrase), true, `${phrase} should be present in navigation`);
  }
  for (const brandPhrase of ["/images/aleo-gilt-header-brand.png", "ALEO GILT", "inner-brand-image", "brand-sticker"]) {
    assert.equal(source.includes(brandPhrase), true, `${brandPhrase} should be used by the inner-page navigation`);
  }
  assert.equal(source.includes(">zkBugBounty</span>"), false, "the old text lockup must not remain in inner-page navigation");
  for (const forbidden of ["useAppState", "switchActor", "roleDisplayLabels", "<select"]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must stay out of global navigation`);
  }
});
