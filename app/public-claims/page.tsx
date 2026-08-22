"use client";

import { AleoBountyRegistryPanel } from "@/components/aleo-bounty-registry-panel";
import { AleoClaimReceiptPanel } from "@/components/aleo-claim-receipt-panel";
import { AleoDeploymentStatus } from "@/components/aleo-deployment-status";
import { AleoPublicIndex } from "@/components/aleo-public-index";
import { useLocale } from "@/components/locale-provider";

export default function PublicClaimsPage() {
  const { copy } = useLocale();

  return (
    <div className="grid gap-6">
      <section className="surface-card-strong workflow-hero rounded-lg p-6 sm:p-7">
        <p className="page-kicker mb-3 text-cyan-200">{copy.publicClaims.kicker}</p>
        <h1 className="gradient-heading text-3xl font-semibold tracking-normal sm:text-4xl">{copy.publicClaims.title}</h1>
        <p className="muted-copy mt-3 max-w-2xl">{copy.publicClaims.description}</p>
      </section>
      <AleoPublicIndex />
      <AleoDeploymentStatus />
      <AleoBountyRegistryPanel />
      <AleoClaimReceiptPanel />
    </div>
  );
}
