"use client";

import { AleoBountyRegistryPanel } from "@/components/aleo-bounty-registry-panel";
import { AleoClaimReceiptPanel } from "@/components/aleo-claim-receipt-panel";
import { AleoDeploymentStatus } from "@/components/aleo-deployment-status";
import { AleoPublicIndex } from "@/components/aleo-public-index";
import { useLocale } from "@/components/locale-provider";

export default function PublicClaimsPage() {
  const { copy, text } = useLocale();
  const privacyFacts = [
    [text("利用细节：已隐藏", "Exploit Details: Hidden"), copy.privacy.exploitHidden],
    [text("私有见证：从未保存", "Private Witness: Never Stored"), copy.privacy.witnessNeverStored],
    [text("私有证明数据：从未保存", "Private Proof Data: Never Stored"), text("私有证明数据从未保存", "Private Proof data is never stored")],
    [text("验证级别：明确标注", "Verification Level: Explicit"), text("每条漏洞声明都会明确区分模拟验证、本地 Leo 执行与网络确认。", "Each Claim explicitly distinguishes Mock, local Leo development execution, and Network Confirmed.")],
    [text("负责任披露：进行中或已修复", "Responsible Disclosure: In Progress / Patched"), text("负责任披露状态可公开审计。", "Responsible disclosure state is publicly auditable")],
  ] as const;

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
      <section className="grid divide-y divide-white/10 border-y border-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
        {privacyFacts.map(([label, detail]) => <div className="px-4 py-4" key={label}><p className="font-mono text-xs text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold text-white">{detail}</p></div>)}
      </section>
    </div>
  );
}
