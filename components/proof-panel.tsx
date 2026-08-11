"use client";

import { CheckCircle2, LockKeyhole, XCircle } from "lucide-react";

import { AleoNullifierStatus } from "@/components/aleo-nullifier-status";
import { getChineseProtocolValue, translateUiError } from "@/lib/i18n/zh";
import type { ProofResult, ProofVerification, Severity } from "@/lib/models";
import { getImpactBand, getVerificationLabel, getVerificationStatement } from "@/lib/proof-verification";
import { useLocale } from "./locale-provider";

function chineseVerificationLabel(verification?: ProofVerification) {
  if (verification?.level === "NetworkConfirmed") return "Aleo 网络已确认";
  if (verification?.level === "RemoteExecution") return "远程 Leo 执行";
  if (verification?.level === "LocalExecution") return "本地 Leo 执行";
  if (verification?.level === "Simulation") return "模拟验证";
  return "验证暂不可用";
}

function chineseVerificationStatement(verification?: ProofVerification) {
  if (verification?.level === "NetworkConfirmed") return "证明：Aleo 网络已确认｜DemoVault 约束执行已确认，未绑定目标合约状态根";
  if (verification?.level === "RemoteExecution") return "证明：远程 Leo 执行｜尚未完成链上确认";
  if (verification?.level === "LocalExecution") return "证明：本地 Leo 执行｜尚未完成链上确认";
  if (verification?.level === "Simulation") return "证明：模拟验证｜不是链上证明";
  return "证明：暂不可用｜当前没有可验证证明";
}

function chineseImpactBand(severity: Severity) {
  if (severity === "Critical") return "100 及以上（严重级下界）";
  if (severity === "High") return "50-99（高危区间）";
  if (severity === "Medium") return "10-49（中危区间）";
  return "0-9（低危区间）";
}

export function ProofPanel({ proof, error, isLoading = false }: { proof: ProofResult | null; error?: string; isLoading?: boolean }) {
  const { copy, text } = useLocale();
  const absent = copy.common.notIssued;
  const verificationLabel = text(chineseVerificationLabel(proof?.verification), getVerificationLabel(proof?.verification));
  const verificationStatement = text(chineseVerificationStatement(proof?.verification), getVerificationStatement(proof?.verification));
  const impactBand = proof ? text(chineseImpactBand(proof.severity), getImpactBand(proof.severity)) : "";
  const proofEngine = proof ? text(getChineseProtocolValue(proof.proofEngine), proof.proofEngine) : "";
  const bugType = proof ? text(getChineseProtocolValue(proof.bugType), proof.bugType) : "";
  const affectedModule = proof ? text(getChineseProtocolValue(proof.affectedModule), proof.affectedModule) : "";
  const ruleName = proof ? text(getChineseProtocolValue(proof.ruleName), proof.ruleName) : "";
  const network = proof?.verification?.network
    ? text(getChineseProtocolValue(proof.verification.network), proof.verification.network)
    : text("暂不可用", "unavailable");
  const terminalOutput = isLoading
    ? `> ${copy.submit.generating}`
    : error
      ? `> ${copy.proofPanel.rejected}\n> ${translateUiError(error)}`
      : proof
        ? `> ${proofEngine} ${text("已生成公开结果", "generated public output")}\n> ${text("验证级别", "verification")}: ${verificationLabel}\n> ${text("是否已验证", "verified")}: ${proof.verified}\n> ${text("证明状态", "proof status")}: ${copy.status.proof[proof.proofStatus]}\n> ${text("声明哈希", "claim hash")}: ${proof.claimHash || absent}\n> ${text("见证承诺", "witness commitment")}: ${proof.witnessCommitment || absent}\n> ${text("防重复标识", "nullifier")}: ${proof.nullifier || absent}\n> ${text("注册表键", "registry key")}: ${proof.registryKey || absent}\n> ${text("严重程度", "severity")}: ${copy.status.severity[proof.severity]}\n> ${text("漏洞类型", "bug type")}: ${bugType}\n> ${text("利用细节", "Exploit Details")}: ${text("已隐藏", "Hidden")}\n> ${text("收据编号", "receipt")}: ${proof.receiptId || absent}${proof.reason ? `\n> ${text("原因", "reason")}: ${translateUiError(proof.reason)}` : ""}`
        : `> ${copy.proofPanel.waiting}\n> ${text("仅输出公开元数据", "Public Metadata output only")}`;

  return (
    <section className="terminal-panel rounded-lg p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between border-b border-cyan-300/15 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100"><LockKeyhole size={17} aria-hidden="true" />{copy.proofPanel.title}</div>
        <span className="rounded-md border border-violet-300/25 bg-violet-300/10 px-2 py-1 text-xs text-violet-100">{copy.proofPanel.publicOnly}</span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-7 text-slate-300">{terminalOutput}</pre>
      {proof ? <div className="mt-4 grid gap-3 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-sm sm:grid-cols-2">
        <ProofField label={text("证明引擎", "Proof Engine")} value={proofEngine} />
        <ProofField label={text("验证级别", "Verification Level")} value={verificationLabel} />
        <ProofField label={text("证明说明", "Verification Statement")} value={verificationStatement} />
        <ProofField label={text("网络", "Network")} value={network} />
        <ProofField label={text("程序编号", "Program ID")} value={proof.verification?.programId ?? absent} mono />
        {proof.verification?.transactionId ? <ProofField label={text("交易编号", "Transaction ID")} value={proof.verification.transactionId} mono /> : null}
        <ProofField label={text("证明状态", "Proof Status")} value={copy.status.proof[proof.proofStatus]} />
        <ProofField label={text("安全规则", "Security rule name")} value={ruleName} />
        <ProofField label={text("受影响模块", "Affected module")} value={affectedModule} />
        <ProofField label={text("影响区间", "Impact Band")} value={impactBand} />
        <ProofField label={text("漏洞类型", "Bug Type")} value={bugType} />
        <ProofField label={text("严重程度", "Severity")} value={copy.status.severity[proof.severity]} />
        <ProofField label={text("声明哈希", "Claim Hash")} value={proof.claimHash || absent} mono />
        <ProofField label={text("见证承诺", "Witness Commitment")} value={proof.witnessCommitment || absent} mono />
        <ProofField label={text("防重复标识", "Nullifier")} value={proof.nullifier || absent} mono />
        <ProofField label={text("报告者承诺", "Reporter Commitment")} value={proof.reporterCommitment || absent} mono />
        <ProofField label={text("收据编号", "Receipt ID")} value={proof.receiptId || absent} mono />
        <ProofField label={text("注册表键", "Registry Key")} value={proof.registryKey || absent} mono />
        <ProofField label={text("协议版本", "Protocol Version")} value={proof.protocolVersion.version} />
        <ProofField label={text("利用细节", "Exploit Details")} value={text("已隐藏", "Hidden")} />
      </div> : null}
      {proof?.proofEngine === "Aleo Leo Proof" ? <AleoNullifierStatus nullifier={proof.nullifier} verification={proof.verification} /> : null}
      <div className="mt-4 flex items-center gap-2 text-sm">
        {proof?.verified ? <><CheckCircle2 className="text-violet-300" size={18} aria-hidden="true" /><span className="text-violet-100">{copy.proofPanel.ready}</span></> : <><XCircle className={error || proof ? "text-red-300" : "text-slate-500"} size={18} aria-hidden="true" /><span className={error || proof ? "text-red-100" : "text-slate-400"}>{copy.proofPanel.notReady}</span></>}
      </div>
    </section>
  );
}

function ProofField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 break-all text-slate-100 ${mono ? "font-mono" : ""}`}>{value}</p></div>;
}