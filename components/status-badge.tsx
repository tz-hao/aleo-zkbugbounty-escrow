import type { DisclosureStatus, PayoutStatus, ProofStatus, Severity } from "@/lib/models";
import { zh } from "@/lib/i18n/zh";

const severityClass: Record<Severity, string> = {
  Low: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  Medium: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  High: "border-violet-300/30 bg-violet-300/10 text-violet-100",
  Critical: "border-red-400/45 bg-red-500/16 text-red-100",
};

const proofClass: Record<ProofStatus, string> = {
  Pending: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  Verified: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  Invalid: "border-red-400/35 bg-red-500/12 text-red-100",
};

const disclosureClass: Record<DisclosureStatus, string> = {
  NotRequested: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  Requested: "border-violet-300/30 bg-violet-300/10 text-violet-100",
  EncryptedDetailsShared: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  Patched: "border-amber-300/30 bg-amber-300/10 text-amber-100",
};

const payoutClass: Record<PayoutStatus, string> = {
  Unfunded: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  RewardLocked: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  Paid: "border-emerald-300/35 bg-emerald-300/14 text-emerald-100",
  Rejected: "border-red-400/35 bg-red-500/12 text-red-100",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold ${severityClass[severity]}`}>
      {zh.status.severity[severity]}
    </span>
  );
}

export function ProofStatusBadge({ status }: { status: ProofStatus }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold ${proofClass[status]}`}>
      {zh.status.proof[status]}
    </span>
  );
}

export function DisclosureStatusBadge({ status }: { status: DisclosureStatus }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold ${disclosureClass[status]}`}>
      {zh.status.disclosure[status]}
    </span>
  );
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold ${payoutClass[status]}`}>
      {zh.status.payout[status]}
    </span>
  );
}
