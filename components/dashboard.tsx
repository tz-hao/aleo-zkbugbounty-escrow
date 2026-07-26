import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { HeroProofVisual } from "./hero-proof-visual";
import { zh } from "@/lib/i18n/zh";

export function Dashboard() {
  return (
    <section className="home-immersive section-reveal" aria-labelledby="home-title">
      <HeroProofVisual />

      <div className="home-immersive-top">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-100">
          <span className="network-pulse" aria-hidden="true" />
          Aleo Testnet
        </span>
        <span className="hidden font-mono text-[0.68rem] text-slate-500 sm:block">
          zkbugbounty_7f3c92.aleo
        </span>
      </div>

      <div className="home-immersive-content">
        <p className="page-kicker">Private by default</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-medium leading-[1.08] text-white sm:text-6xl lg:text-7xl" id="home-title">
          证明漏洞存在
          <span className="gradient-heading-accent block">Exploit 无需公开</span>
        </h1>
        <p className="mt-5 max-w-2xl font-mono text-xs font-medium leading-6 text-cyan-50/80 sm:text-sm">
          {zh.brand.slogan}
        </p>
        <Link className="focus-ring home-enter-action mt-8" href="/submit-proof">
          {zh.home.proofAction}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>

      <span className="home-immersive-mark" aria-hidden="true">
        <ShieldCheck size={22} />
      </span>
    </section>
  );
}
