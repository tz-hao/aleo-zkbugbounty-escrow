import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { HeroProofVisual } from "./hero-proof-visual";
import { zh } from "@/lib/i18n/zh";

export function Dashboard() {
  return (
    <section className="home-immersive section-reveal" aria-labelledby="home-title">
      <HeroProofVisual />

      <div className="home-immersive-top">
        <span className="inline-flex items-center gap-2 text-[0.68rem] font-medium text-emerald-100/80">
          <span className="network-pulse" aria-hidden="true" />
          Aleo Testnet · Network confirmed
        </span>
        <span className="hidden font-mono text-[0.64rem] text-slate-600 sm:block">
          zkbugbounty_7f3c92.aleo
        </span>
      </div>

      <div className="home-immersive-content">
        <p className="home-protocol-label">Private Witness · Public Proof</p>
        <h1 className="home-protocol-title" id="home-title">
          证明漏洞存在
          <span>Exploit 保持私密</span>
        </h1>
        <p className="home-protocol-slogan">
          {zh.brand.slogan}
        </p>
        <Link className="focus-ring home-enter-action" href="/submit-proof">
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
