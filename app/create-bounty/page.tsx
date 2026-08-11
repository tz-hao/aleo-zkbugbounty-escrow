"use client";

import { BountyCreationWorkspace } from "@/components/bounty-creation-workspace";
import { useLocale } from "@/components/locale-provider";

export default function CreateBountyPage() {
  const { copy } = useLocale();

  return (
    <div className="grid gap-6">
      <section className="surface-card-strong workflow-hero rounded-lg p-6 sm:p-7">
        <p className="page-kicker mb-3">{copy.createBounty.kicker}</p>
        <h1 className="gradient-heading text-3xl font-semibold tracking-normal sm:text-4xl">
          {copy.createBounty.title}
        </h1>
        <p className="muted-copy mt-3 max-w-2xl">{copy.createBounty.description}</p>
      </section>
      <BountyCreationWorkspace />
    </div>
  );
}