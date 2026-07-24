"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { AleoBountyRegistryPanel } from "@/components/aleo-bounty-registry-panel";
import { AleoClaimReceiptPanel } from "@/components/aleo-claim-receipt-panel";
import { AleoDeploymentStatus } from "@/components/aleo-deployment-status";
import { AleoPublicIndex } from "@/components/aleo-public-index";
import {
  DisclosureStatusBadge,
  PayoutStatusBadge,
  ProofStatusBadge,
  SeverityBadge,
} from "@/components/status-badge";
import { useAppState } from "@/components/app-state-provider";
import { canViewPublicClaims } from "@/lib/permissions";
import { getRuleDisplayName, zh } from "@/lib/i18n/zh";
import { getImpactBand, getVerificationLabel, getVerificationStatement } from "@/lib/proof-verification";

export default function PublicClaimsPage() {
  const { state } = useAppState();
  const canView = canViewPublicClaims(state.currentActor);
  const visibleClaims = state.publicClaimRegistry.filter((entry) => entry.payoutStatus !== "Rejected");

  return (
    <div className="grid gap-6">
      <section className="surface-card-strong rounded-lg p-6 sm:p-7">
        <p className="page-kicker mb-3 text-emerald-200">{zh.publicClaims.kicker}</p>
        <div className="grid gap-5 lg:grid-cols-[1fr_0.42fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              {zh.publicClaims.title}
            </h1>
            <p className="muted-copy mt-3 max-w-2xl">
              {zh.publicClaims.description}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm text-emerald-100">
            {zh.publicClaims.registryNotice}
          </div>
        </div>
      </section>

      <AleoDeploymentStatus />
      <AleoPublicIndex />
      <AleoBountyRegistryPanel />
      <AleoClaimReceiptPanel />

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Exploit Details: Hidden", zh.privacy.exploitHidden],
          ["Private Witness: Never Stored", zh.privacy.witnessNeverStored],
          ["Private Proof Data: Never Stored", "Private Proof 数据从未保存"],
          ["Verification Level: Explicit", "每条 Claim 明确区分 Mock、Local Leo 开发执行与 Network Confirmed"],
          ["Responsible Disclosure: In Progress / Patched", "Responsible Disclosure 状态公开可审计"],
        ].map(([label, detail]) => (
          <div className="surface-card rounded-lg p-4" key={label}>
            <p className="font-mono text-[0.68rem] text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-white">{detail}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-4">
        <div>
          <p className="page-kicker">Demo Mode Registry</p>
          <p className="mt-1 text-sm text-slate-400">以下卡片来自本地演示状态，不属于 Aleo Testnet Registry。</p>
        </div>
        <span className="rounded-md border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-xs text-violet-100">
          Mock / Local State
        </span>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {canView
          ? visibleClaims.map((entry) => {
              const bounty = state.bounties.find((item) => item.id === entry.bountyId);
              const receipt = state.claimReceipts.find((item) => item.receiptId === entry.receiptId);
              const patchedStatus = entry.disclosureStatus === "Patched" ? "已修复" : zh.common.pending;
              const paidStatus = entry.payoutStatus === "Paid" ? "已标记支付（Demo State）" : zh.common.pending;

              return (
                <article className="surface-card grid gap-5 rounded-lg p-5" key={entry.registryKey}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs tracking-normal text-slate-500">项目</p>
                      <h2 className="text-lg font-semibold text-white">{bounty?.projectName ?? "Unknown Project"}</h2>
                      <p className="mt-1 text-sm text-slate-400">{entry.bugType}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SeverityBadge severity={entry.severity} />
                      <ProofStatusBadge status={entry.proofStatus} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <RegistryField label="安全规则（Rule Name）" value={getRuleDisplayName(entry.ruleId, entry.ruleName)} />
                    <RegistryField label="受影响模块" value={entry.affectedModule} />
                    <RegistryField label="Impact Band" value={getImpactBand(entry.severity)} />
                    <RegistryField label="Bug Type" value={entry.bugType} />
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        披露状态（Disclosure Status）
                      </p>
                      <div className="mt-2">
                        <DisclosureStatusBadge status={entry.disclosureStatus} />
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        支付状态（Payout Status）
                      </p>
                      <div className="mt-2">
                        <PayoutStatusBadge status={entry.payoutStatus} />
                      </div>
                    </div>
                    <RegistryField label="修复状态" value={patchedStatus} />
                    <RegistryField label="支付状态" value={paidStatus} />
                    <RegistryField label="Receipt ID" value={entry.receiptId} mono />
                    <RegistryField label="Claim Hash" value={entry.claimHash} mono />
                    <RegistryField label="Registry Key" value={entry.registryKey} mono />
                    <RegistryField label="Witness Commitment" value={entry.witnessCommitment} mono />
                    <RegistryField label="Nullifier" value={entry.nullifier} mono />
                    <RegistryField label="Proof Engine" value={entry.proofEngine} />
                    <RegistryField label="Verification Level" value={getVerificationLabel(entry.verification)} />
                    <RegistryField label="Proof Statement" value={getVerificationStatement(entry.verification)} />
                    <RegistryField label="Network" value={entry.verification?.network ?? "unavailable"} />
                    {entry.verification?.transactionId ? (
                      <RegistryField label="Transaction ID" value={entry.verification.transactionId} mono />
                    ) : null}
                    <RegistryField label="Protocol Version" value={receipt?.protocolVersion.version ?? "Unknown"} />
                    <RegistryField label="Exploit Details" value="Hidden｜细节已隐藏" />
                    <RegistryField label="Private Witness" value="Never Stored｜从未保存" />
                  </div>
                  <Link className="focus-ring secondary-action w-fit" href={`/public-claims/${entry.registryKey}`}>
                    {zh.publicClaims.viewReceipt}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </article>
              );
            })
          : null}
      </section>
      {canView && visibleClaims.length === 0 ? (
        <div className="surface-card rounded-lg p-6 text-sm text-slate-400">{zh.publicClaims.noClaims}</div>
      ) : null}
    </div>
  );
}

function RegistryField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-1 break-all text-sm text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
