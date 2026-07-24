"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Copy, ReceiptText } from "lucide-react";
import { useState } from "react";
import { useAppState } from "@/components/app-state-provider";
import { DisclosureStatusBadge, PayoutStatusBadge, ProofStatusBadge, SeverityBadge } from "@/components/status-badge";
import { zh } from "@/lib/i18n/zh";
import { getVerificationLabel, getVerificationStatement } from "@/lib/proof-verification";

export default function PublicReceiptPage() {
  const { state } = useAppState();
  const params = useParams<{ registryKey: string }>();
  const entry = state.publicClaimRegistry.find((item) => item.registryKey === params.registryKey);
  const receipt = entry ? state.claimReceipts.find((item) => item.receiptId === entry.receiptId) : null;
  const bounty = entry ? state.bounties.find((item) => item.id === entry.bountyId) : null;

  if (!entry) {
    return (
      <section className="surface-card-strong rounded-lg p-6">
        <p className="page-kicker mb-3">Registry Lookup</p>
        <h1 className="text-2xl font-semibold text-white">{zh.receipt.notFoundTitle}</h1>
        <p className="muted-copy mt-2">{zh.receipt.notFoundBody}</p>
        <Link className="focus-ring secondary-action mt-5 w-fit" href="/public-claims">
          <ArrowLeft size={16} aria-hidden="true" /> {zh.receipt.back}
        </Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="surface-card-strong rounded-lg p-6 sm:p-7">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm text-cyan-100" href="/public-claims">
          <ArrowLeft size={16} aria-hidden="true" /> {zh.receipt.back}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="page-kicker mb-3">{zh.receipt.kicker}</p>
            <h1 className="text-3xl font-semibold text-white">{bounty?.projectName ?? zh.receipt.titleFallback}</h1>
            <p className="muted-copy mt-2">{zh.receipt.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={entry.severity} />
            <ProofStatusBadge status={entry.proofStatus} />
            <DisclosureStatusBadge status={entry.disclosureStatus} />
            <PayoutStatusBadge status={entry.payoutStatus} />
          </div>
        </div>
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <ReceiptText className="text-cyan-200" size={18} aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">{zh.receipt.fieldsTitle}</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CopyField label="Receipt ID" value={entry.receiptId} />
          <CopyField label="Claim Hash" value={entry.claimHash} />
          <CopyField label="Registry Key" value={entry.registryKey} />
          <CopyField label="Witness Commitment" value={entry.witnessCommitment} />
          <CopyField label="Nullifier" value={entry.nullifier} />
          <CopyField label="Scope Hash" value={receipt?.scopeHash ?? "Unavailable"} />
          <CopyField label="Rule" value={entry.ruleName} />
          <CopyField label="Proof Engine" value={entry.proofEngine} />
          <CopyField label="Verification Level" value={getVerificationLabel(entry.verification)} />
          <CopyField label="Network" value={entry.verification?.network ?? "unavailable"} />
          <CopyField label="Program ID" value={entry.verification?.programId ?? "Unavailable"} />
          {entry.verification?.transactionId ? (
            <CopyField label="Transaction ID" value={entry.verification.transactionId} />
          ) : null}
          <CopyField label="Protocol Version" value={receipt?.protocolVersion.version ?? "Unknown"} />
          <CopyField label="Affected Module" value={entry.affectedModule} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Exploit Details: Hidden", zh.privacy.exploitHidden],
          ["Private Witness: Never Stored", zh.privacy.witnessNeverStored],
          ["Verification Status", getVerificationStatement(entry.verification)],
        ].map(([label, value]) => (
          <div className="surface-card rounded-lg p-4" key={label}>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
            <p className="mt-1 font-semibold text-emerald-100">{value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <button aria-label={`${zh.receipt.copy} ${label}`} className="focus-ring flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100" onClick={copyValue} type="button">
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </div>
      <p className="mt-2 break-all font-mono text-sm text-cyan-100">{value}</p>
      <span aria-live="polite" className="sr-only">{copied ? `${label} ${zh.receipt.copied}` : ""}</span>
    </div>
  );
}
