import { BountyCreationWorkspace } from "@/components/bounty-creation-workspace";
import { zh } from "@/lib/i18n/zh";

export default function CreateBountyPage() {
  return (
    <div className="grid gap-6">
      <section className="surface-card-strong rounded-lg p-6 sm:p-7">
        <p className="page-kicker mb-3">{zh.createBounty.kicker}</p>
        <div className="grid gap-5 lg:grid-cols-[1fr_0.42fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              {zh.createBounty.title}
            </h1>
            <p className="muted-copy mt-3 max-w-2xl">
              {zh.createBounty.description}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm text-emerald-100">
            {zh.createBounty.ownerNotice}
          </div>
        </div>
      </section>
      <BountyCreationWorkspace />
    </div>
  );
}
