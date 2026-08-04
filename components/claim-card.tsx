import { EyeOff, Fingerprint, ReceiptText } from "lucide-react";
import type { Bounty, BugClaim } from "@/lib/models";
import {
  DisclosureStatusBadge,
  PayoutStatusBadge,
  ProofStatusBadge,
  SeverityBadge,
} from "./status-badge";
import { zh } from "@/lib/i18n/zh";

export function ClaimCard({
  claim,
  bounty,
  showCommitment = false,
}: {
  claim: BugClaim;
  bounty?: Bounty;
  showCommitment?: boolean;
}) {
  return (
    <article className="surface-card rounded-lg p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={claim.severity} />
            <ProofStatusBadge status={claim.proofStatus} />
            <DisclosureStatusBadge status={claim.disclosureStatus} />
            <PayoutStatusBadge status={claim.payoutStatus} />
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">{claim.bugType}</h3>
          <p className="mt-1 text-sm text-slate-400">{bounty?.projectName ?? claim.bountyId}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-cyan-100">
          {claim.claimHash}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="border-l border-white/10 py-1 pl-3">
          <p className="text-xs tracking-normal text-slate-500">声明收据（Claim Receipt）</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-xs text-slate-200">
            <ReceiptText size={14} aria-hidden="true" />
            {claim.claimReceiptId}
          </p>
        </div>
        <div className="border-l border-white/10 py-1 pl-3">
          <p className="text-xs tracking-normal text-slate-500">奖励档位（Reward Tier）</p>
          <p className="mt-1 text-sm text-slate-200">
            {bounty ? `${bounty.rewards[claim.severity.toLowerCase() as keyof Bounty["rewards"]]} ALEO` : "Public"}
          </p>
        </div>
        <div className="border-l border-white/10 py-1 pl-3">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <EyeOff size={14} aria-hidden="true" />
            Exploit Details
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-cyan-100">
            <Fingerprint size={14} aria-hidden="true" />
            {zh.privacy.exploitHidden}
          </p>
        </div>
      </div>
      {showCommitment ? (
        <div className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-300/8 p-3">
          <p className="text-xs text-cyan-100/70">Witness Commitment</p>
          <p className="mt-1 break-all font-mono text-xs text-cyan-100">{claim.witnessCommitment}</p>
        </div>
      ) : null}
    </article>
  );
}
