import { CheckCircle2, LockKeyhole, XCircle } from "lucide-react";
import type { ProofResult } from "@/lib/models";
import { translateUiError, zh } from "@/lib/i18n/zh";
import { getImpactBand, getVerificationLabel, getVerificationStatement } from "@/lib/proof-verification";
import { AleoNullifierStatus } from "@/components/aleo-nullifier-status";

export function ProofPanel({
  proof,
  error,
  isLoading = false,
}: {
  proof: ProofResult | null;
  error?: string;
  isLoading?: boolean;
}) {
  return (
    <section className="terminal-panel rounded-lg p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between border-b border-cyan-300/15 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
          <LockKeyhole size={17} aria-hidden="true" />
          {zh.proofPanel.title}
        </div>
        <span className="rounded-md border border-violet-300/25 bg-violet-300/10 px-2 py-1 text-xs text-violet-100">
          {zh.proofPanel.publicOnly}
        </span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-7 text-slate-300">
        {isLoading
          ? `> ${zh.submit.generating}`
          : error
          ? `> ${zh.proofPanel.rejected}\n> ${error}`
          : proof
            ? `> ${proof.proofEngine} 已生成公开结果\n> verification: ${getVerificationLabel(proof.verification)}\n> verified: ${proof.verified}\n> proofStatus: ${zh.status.proof[proof.proofStatus]} (${proof.proofStatus})\n> claimHash: ${proof.claimHash || zh.common.notIssued}\n> witnessCommitment: ${proof.witnessCommitment || zh.common.notIssued}\n> nullifier: ${proof.nullifier || zh.common.notIssued}\n> registryKey: ${proof.registryKey || zh.common.notIssued}\n> severity: ${proof.severity}\n> bugType: ${proof.bugType}\n> Exploit Details: Hidden\n> receipt: ${proof.receiptId || zh.common.notIssued}${proof.reason ? `\n> reason: ${translateUiError(proof.reason)}` : ""}`
            : `> ${zh.proofPanel.waiting}\n> 仅输出 Public Metadata`}
      </pre>
      {proof ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-sm sm:grid-cols-2">
          <ProofField label="Proof Engine" value={proof.proofEngine} />
          <ProofField label="Verification Level" value={getVerificationLabel(proof.verification)} />
          <ProofField label="Verification Statement" value={getVerificationStatement(proof.verification)} />
          <ProofField label="Network" value={proof.verification?.network ?? "unavailable"} />
          <ProofField label="Program ID" value={proof.verification?.programId ?? zh.common.notIssued} mono />
          {proof.verification?.transactionId ? (
            <ProofField label="Transaction ID" value={proof.verification.transactionId} mono />
          ) : null}
          <ProofField label="Proof Status" value={`${zh.status.proof[proof.proofStatus]}（${proof.proofStatus}）`} />
          <ProofField label="安全规则（Rule Name）" value={proof.ruleName} />
          <ProofField label="受影响模块" value={proof.affectedModule} />
          <ProofField label="Impact Band" value={getImpactBand(proof.severity)} />
          <ProofField label="Bug Type" value={proof.bugType} />
          <ProofField label="Severity" value={proof.severity} />
          <ProofField label="Claim Hash" value={proof.claimHash || zh.common.notIssued} mono />
          <ProofField label="Witness Commitment" value={proof.witnessCommitment || zh.common.notIssued} mono />
          <ProofField label="Nullifier" value={proof.nullifier || zh.common.notIssued} mono />
          <ProofField label="Reporter Commitment" value={proof.reporterCommitment || zh.common.notIssued} mono />
          <ProofField label="Receipt ID" value={proof.receiptId || zh.common.notIssued} mono />
          <ProofField label="Registry Key" value={proof.registryKey || zh.common.notIssued} mono />
          <ProofField label="Protocol Version" value={proof.protocolVersion.version} />
          <ProofField label="Exploit Details" value="Hidden｜细节已隐藏" />
        </div>
      ) : null}
      {proof?.proofEngine === "Aleo Leo Proof" ? (
        <AleoNullifierStatus nullifier={proof.nullifier} verification={proof.verification} />
      ) : null}
      <div className="mt-4 flex items-center gap-2 text-sm">
        {proof?.verified ? (
          <>
            <CheckCircle2 className="text-violet-300" size={18} aria-hidden="true" />
            <span className="text-violet-100">{zh.proofPanel.ready}</span>
          </>
        ) : (
          <>
            <XCircle className={error || proof ? "text-red-300" : "text-slate-500"} size={18} aria-hidden="true" />
            <span className={error || proof ? "text-red-100" : "text-slate-400"}>{zh.proofPanel.notReady}</span>
          </>
        )}
      </div>
    </section>
  );
}

function ProofField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 break-all text-slate-100 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
