import { AleoBountyRegistryPanel } from "@/components/aleo-bounty-registry-panel";
import { AleoClaimReceiptPanel } from "@/components/aleo-claim-receipt-panel";
import { AleoDeploymentStatus } from "@/components/aleo-deployment-status";
import { AleoPublicIndex } from "@/components/aleo-public-index";
import { zh } from "@/lib/i18n/zh";

export default function PublicClaimsPage() {
  return (
    <div className="grid gap-6">
      <section className="surface-card-strong workflow-hero rounded-lg p-6 sm:p-7">
        <p className="page-kicker mb-3 text-emerald-200">{zh.publicClaims.kicker}</p>
        <div>
          <div>
            <h1 className="gradient-heading text-3xl font-semibold tracking-normal sm:text-4xl">
              {zh.publicClaims.title}
            </h1>
            <p className="muted-copy mt-3 max-w-2xl">
              {zh.publicClaims.description}
            </p>
          </div>
        </div>
      </section>

      <AleoPublicIndex />
      <AleoDeploymentStatus />
      <AleoBountyRegistryPanel />
      <AleoClaimReceiptPanel />

      <section className="grid divide-y divide-white/10 border-y border-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        {[
          ["Exploit Details: Hidden", zh.privacy.exploitHidden],
          ["Private Witness: Never Stored", zh.privacy.witnessNeverStored],
          ["Private Proof Data: Never Stored", "Private Proof 数据从未保存"],
          ["Verification Level: Explicit", "每条 Claim 明确区分 Mock、Local Leo 开发执行与 Network Confirmed"],
          ["Responsible Disclosure: In Progress / Patched", "Responsible Disclosure 状态公开可审计"],
        ].map(([label, detail]) => (
          <div className="px-4 py-4" key={label}>
            <p className="font-mono text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-white">{detail}</p>
          </div>
        ))}
      </section>

    </div>
  );
}
