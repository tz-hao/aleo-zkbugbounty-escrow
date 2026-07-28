import { BountyCreationWorkspace } from "@/components/bounty-creation-workspace";
import { zh } from "@/lib/i18n/zh";

export default function CreateBountyPage() {
  return (
    <div className="grid gap-6">
      <section className="surface-card-strong workflow-hero rounded-lg p-6 sm:p-7">
        <p className="page-kicker mb-3">{zh.createBounty.kicker}</p>
        <div>
          <div>
            <h1 className="gradient-heading text-3xl font-semibold tracking-normal sm:text-4xl">
              {zh.createBounty.title}
            </h1>
            <p className="muted-copy mt-3 max-w-2xl">
              {zh.createBounty.description}
            </p>
          </div>
        </div>
      </section>
      <BountyCreationWorkspace />
    </div>
  );
}
