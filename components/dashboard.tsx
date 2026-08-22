"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HeroProofVisual } from "./hero-proof-visual";
import { LanguageSwitcher } from "./language-switcher";
import { useLocale } from "./locale-provider";
import { WalletConnectionControl } from "./wallet-connection-control";

export function Dashboard() {
  const { copy } = useLocale();

  return (
    <section className="home-immersive section-reveal" aria-labelledby="home-title">
      <HeroProofVisual />

      <header className="home-immersive-top">
        <div className="home-brand-lockup">
          <Image
            alt="ALEO GILT"
            className="home-brand-image"
            height={576}
            priority
            src="/images/aleo-gilt-header-brand.png"
            width={1024}
          />
        </div>

        <div className="home-nav-actions">
          <LanguageSwitcher compact />
          <div className="home-wallet-control">
            <WalletConnectionControl />
          </div>
        </div>
      </header>

      <div className="home-immersive-content">
        <p className="home-protocol-label">{copy.home.kicker}</p>
        <h1 className="home-protocol-title" id="home-title">
          {copy.home.title}
        </h1>
        <Link className="focus-ring home-enter-action" href="/submit-proof">
          {copy.home.proofAction}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
