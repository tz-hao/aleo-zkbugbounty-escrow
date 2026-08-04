import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HeroProofVisual } from "./hero-proof-visual";
import { zh } from "@/lib/i18n/zh";

export function Dashboard() {
  return (
    <section className="home-immersive section-reveal" aria-labelledby="home-title">
      <HeroProofVisual />

      <div className="home-immersive-content">
        <p className="home-protocol-label">Private Witness · Public Proof</p>
        <h1 className="home-protocol-title" id="home-title">
          证明漏洞存在
          <span>Exploit 保持私密</span>
        </h1>
        <Link className="focus-ring home-enter-action" href="/submit-proof">
          {zh.home.proofAction}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
