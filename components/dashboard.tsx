"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HeroProofVisual } from "./hero-proof-visual";
import { LanguageSwitcher } from "./language-switcher";
import { useLocale } from "./locale-provider";

export function Dashboard() {
  const { copy, text } = useLocale();
  return (
    <section className="home-immersive section-reveal" aria-labelledby="home-title">
      <HeroProofVisual />
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6"><LanguageSwitcher /></div>
      <div className="home-immersive-content">
        <p className="home-protocol-label">{text("私有见证 · 公开证明", "Private Witness · Public Proof")}</p>
        <h1 className="home-protocol-title" id="home-title">
          {text("证明漏洞存在", "Prove a bug exists")}
          <span>{text("利用细节保持私密", "Keep the exploit private")}</span>
        </h1>
        <Link className="focus-ring home-enter-action" href="/submit-proof">
          {copy.home.proofAction}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}