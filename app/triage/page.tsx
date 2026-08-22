"use client";

import { AlertTriangle, Bot, CheckCircle2, Clock3, FileText, ReceiptText } from "lucide-react";
import { useState } from "react";
import { ClaimCard } from "@/components/claim-card";
import { DemoRolePreview } from "@/components/demo-role-preview";
import { ProtocolV3Workflow } from "@/components/protocol-v3-workflow";
import { ProtocolV3Workbench } from "@/components/protocol-v3-workbench";
import { RewardEscrowStatus } from "@/components/reward-escrow-status";
import { TriageActionControls } from "@/components/triage-action-controls";
import { useAppState } from "@/components/app-state-provider";
import {
  buildTriageCopilotMetadata,
  generateTriageCopilotRecommendation,
  localTriageCopilotProvider,
} from "@/lib/ai-triage-copilot";
import { canViewTriage } from "@/lib/permissions";
import { roleDisplayLabels } from "@/lib/i18n/glossary";
import { useLocale } from "@/components/locale-provider";
import { formatZhDateTime } from "@/lib/format";
import { getChineseProtocolValue } from "@/lib/i18n/zh";
import { getClaimWorkflowGuidance } from "@/lib/state-machine";
import { getImpactBand, getVerificationLabel, getVerificationStatement } from "@/lib/proof-verification";

export default function TriagePage() {
  const { state } = useAppState();
  const { copy, text } = useLocale();
  const [triageMode, setTriageMode] = useState<"onchain" | "demo">("onchain");
  const actor = state.currentActor;
  const hasTriageAccess = canViewTriage(actor);
  const visibleClaims = state.claims.filter((claim) => {
    const bounty = state.bounties.find((item) => item.id === claim.bountyId);
    if (actor.role === "ProjectOwner") {
      return bounty?.ownerId === actor.id;
    }
    if (actor.role === "Whitehat") {
      return claim.reporterId === actor.id;
    }
    return actor.role === "TriageArbiter";
  });
  return (
    <div className="grid gap-6">
      <section className="surface-card-strong workflow-hero rounded-lg p-6 sm:p-7">
        <p className="page-kicker mb-3 text-violet-200">{copy.triage.kicker}</p>
        <div>
          <div>
            <h1 className="gradient-heading text-3xl font-semibold tracking-normal sm:text-4xl">
              {copy.triage.title}
            </h1>
            <p className="muted-copy mt-3 max-w-2xl">
              {copy.triage.description}
            </p>
          </div>
        </div>
      </section>

      <div className="inline-flex w-fit rounded-md border border-white/10 bg-black/20 p-1" aria-label={text("分诊数据源", "Triage data source")}>
        <button
          className={`focus-ring min-h-11 rounded px-4 py-2 text-sm font-semibold ${
            triageMode === "onchain" ? "bg-cyan-300/15 text-cyan-100" : "text-slate-400"
          }`}
          type="button"
          onClick={() => setTriageMode("onchain")}
        >
          {text("Aleo 测试网", "Aleo Testnet")}
        </button>
        <button
          className={`focus-ring min-h-11 rounded px-4 py-2 text-sm font-semibold ${
            triageMode === "demo" ? "bg-violet-300/15 text-violet-100" : "text-slate-400"
          }`}
          type="button"
          onClick={() => setTriageMode("demo")}
        >
          {text("本地流程演示", "Local flow demo")}
        </button>
      </div>

      <RewardEscrowStatus />

      <ProtocolV3Workflow />

      <ProtocolV3Workbench />

      {triageMode === "demo" ? (
        <>
      <DemoRolePreview />

      {!hasTriageAccess ? (
        <section className="surface-card rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 text-amber-200" size={20} aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                {copy.triage.noAccessTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                {text("公开用户在本地分诊演示中为只读。可在上方演示预览设置中切换演示视角；该设置不会改变钱包或链上权限。", "A Public User is read-only in the local triage demo. Switch the demo preview above to change the preview role; this does not change wallet or on-chain authority.")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4">
        {hasTriageAccess && visibleClaims.length === 0 ? (
          <div className="glass-panel rounded-lg p-6 text-sm text-slate-400">
            {copy.triage.noClaims}
          </div>
        ) : null}

        {hasTriageAccess
          ? visibleClaims.map((claim) => {
              const bounty = state.bounties.find((item) => item.id === claim.bountyId);
              const receipt = state.claimReceipts.find((item) => item.receiptId === claim.receiptId);
              const packageState = state.disclosurePackages.find((item) => item.claimId === claim.id);
              const timeline = state.triageActions.filter((item) => item.claimId === claim.id);
              const workflow = getClaimWorkflowGuidance(claim);

              if (!bounty) {
                return null;
              }
              const copilot = generateTriageCopilotRecommendation(
                buildTriageCopilotMetadata({
                  claim,
                  bounty,
                  triageActions: timeline,
                }),
              );

              return (
                <article className="grid gap-4" key={claim.id}>
                  <section className="grid gap-3 lg:grid-cols-[1fr_0.72fr]">
                    <div>
                      <h2 className="mb-3 text-base font-semibold text-white">
                        {copy.triage.sections.summary}
                      </h2>
                      <ClaimCard bounty={bounty} claim={claim} />
                    </div>
                    <div className="surface-card rounded-lg p-5">
                      <h2 className="mb-4 text-base font-semibold text-white">{copy.triage.sections.receipt}</h2>
                      <p className="mb-4 text-sm leading-6 text-slate-400">
                        {text("声明收据记录公开证明元数据；验证强度以验证级别为准，不会泄露利用细节。", "Claim Receipt records public Proof Metadata. Verification strength is determined by the Verification Level and does not disclose the Exploit.")}
                      </p>
                      <div className="grid gap-3 text-sm">
                        <ReceiptField label={text("收据编号", "Receipt ID")} value={receipt?.receiptId ?? claim.receiptId} />
                        <ReceiptField label={text("声明哈希", "Claim hash")} value={receipt?.claimHash ?? claim.claimHash} />
                        <ReceiptField label={text("注册表键", "Registry key")} value={claim.registryKey} />
                        <ReceiptField label={text("见证承诺", "Witness commitment")} value={receipt?.witnessCommitment ?? claim.witnessCommitment} />
                        <ReceiptField label={text("防重复标识", "Nullifier")} value={receipt?.nullifier ?? claim.nullifier} />
                        <ReceiptField label={text("安全规则", "Security rule name")} value={text(getChineseProtocolValue(receipt?.ruleName ?? claim.ruleName), receipt?.ruleName ?? claim.ruleName)} />
                        <div className="border-b border-white/10 py-3">
                          <p className="text-xs text-slate-500">
                            {text("证明引擎", "Proof engine")}
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-slate-200">
                            <ReceiptText size={14} aria-hidden="true" />
                            {text("证明引擎：", "Proof engine: ")} {receipt?.proofEngine ? text(getChineseProtocolValue(receipt.proofEngine), receipt.proofEngine) : text("未知", "Unknown")}
                          </p>
                        </div>
                        <ReceiptField label={text("协议版本", "Protocol version")} value={receipt?.protocolVersion.version ?? text("未知", "Unknown")} />
                        <ReceiptField label={text("验证级别", "Verification level")} value={text(getChineseVerificationLabel(receipt?.verification ?? claim.verification), getVerificationLabel(receipt?.verification ?? claim.verification))} />
                        <ReceiptField label={text("证明说明", "Proof statement")} value={text(getChineseVerificationStatement(receipt?.verification ?? claim.verification), getVerificationStatement(receipt?.verification ?? claim.verification))} />
                        <ReceiptField label={text("网络", "Network")} value={text(getChineseNetworkLabel((receipt?.verification ?? claim.verification)?.network), (receipt?.verification ?? claim.verification)?.network ?? "unavailable")} />
                        <ReceiptField label={text("规则编号", "Rule ID")} value={receipt?.ruleId ?? bounty.ruleId} />
                        <ReceiptField label={text("受影响模块", "Affected module")} value={text(getChineseProtocolValue(receipt?.affectedModule ?? claim.affectedModule), receipt?.affectedModule ?? claim.affectedModule)} />
                        <ReceiptField label={text("安全不变量", "Invariant")} value={copy.rules[bounty.ruleId].description} />
                        <ReceiptField label={text("影响区间", "Impact band")} value={text(getChineseImpactBand(receipt?.severity ?? claim.severity), getImpactBand(receipt?.severity ?? claim.severity))} />
                        <ReceiptField label={text("严重程度", "Severity")} value={copy.status.severity[receipt?.severity ?? claim.severity]} />
                        <ReceiptField label={text("范围哈希", "Scope hash")} value={receipt?.scopeHash ?? bounty.scopeHash} />
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                    <div className="surface-card rounded-lg p-5">
                      <h2 className="mb-4 text-base font-semibold text-white">
                        {copy.triage.sections.disclosure}
                      </h2>
                      <p className="mb-4 max-w-2xl text-sm text-slate-400">
                        {copy.triage.privacyNotice}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-4">
                        {[
                          [text("证明状态", "Proof status"), copy.status.proof[claim.proofStatus]],
                          [text("奖励状态", "Reward status"), copy.status.payout[claim.payoutStatus]],
                          [text("披露状态", "Disclosure status"), copy.status.disclosure[claim.disclosureStatus]],
                          [text("披露包", "Disclosure package"), packageState ? text("已分享", packageState.status) : text("尚未分享", "Not shared")],
                        ].map(([label, value]) => (
                          <div className="border-l border-white/10 py-1 pl-3" key={label}>
                            <p className="text-xs text-slate-500">
                              {label}
                            </p>
                            <p className="mt-1 flex items-center gap-2 text-sm text-slate-100">
                              <CheckCircle2 size={14} aria-hidden="true" />
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="surface-card rounded-lg p-5">
                      <h2 className="mb-4 text-base font-semibold text-white">{copy.triage.sections.actions}</h2>
                      <div className="mb-4 grid gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] p-4 sm:grid-cols-3">
                        <WorkflowField
                          label={copy.triage.workflow.current}
                          value={copy.triage.workflow.stages[workflow.currentStage] ?? workflow.currentStage}
                        />
                        <WorkflowField
                          label={copy.triage.workflow.next}
                          value={workflow.nextAction ? copy.triage.workflow.actionLabels[workflow.nextAction] : copy.triage.workflow.final}
                        />
                        <WorkflowField
                          label={copy.triage.workflow.requiredRole}
                          value={workflow.requiredRole ? roleDisplayLabels[workflow.requiredRole] : copy.triage.workflow.none}
                        />
                        {workflow.blockedReason ? (
                          <p className="text-sm text-slate-300 sm:col-span-3">{copy.triage.workflow.terminalReason}</p>
                        ) : null}
                      </div>
                      <TriageActionControls bounty={bounty} claim={claim} />
                    </div>
                  </section>

                  {packageState ? (
                    <section className="surface-card rounded-lg p-5">
                      <h2 className="mb-4 text-base font-semibold text-white">{copy.triage.sections.audit}</h2>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ReceiptField label={text("披露包哈希", "Package hash")} value={packageState.packageHash} />
                        <ReceiptField label={text("接收方密钥编号", "Recipient key ID")} value={packageState.recipientKeyId} />
                        <ReceiptField label={text("披露包版本", "Package version")} value={packageState.packageVersion} />
                        <ReceiptField label={text("加密方案", "Encryption scheme")} value={packageState.encryptionScheme} />
                        <ReceiptField label={text("交付状态", "Delivery status")} value={packageState.deliveryStatus} />
                        <ReceiptField label={text("有效期至", "Valid until")} value={formatZhDateTime(packageState.expiresAt)} />
                      </div>
                    </section>
                  ) : null}

                  <section className="surface-card-strong rounded-lg p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Bot className="text-cyan-200" size={18} aria-hidden="true" />
                      <h2 className="text-base font-semibold text-white">{copy.triage.sections.copilot}</h2>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-400">
                        {text("模拟 · 公开元数据策略引擎", localTriageCopilotProvider.name)}
                      </span>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="border-l border-white/10 py-1 pl-3">
                        <p className="text-xs text-slate-500">
                          {text("风险摘要", "Risk summary")}
                        </p>
                        <p className="mt-2 text-sm text-slate-200">{copilot.riskSummary}</p>
                      </div>
                      <div className="border-l border-white/10 py-1 pl-3">
                        <p className="text-xs text-slate-500">
                          {text("建议下一步", "Recommended next step")}
                        </p>
                        <p className="mt-2 text-sm text-slate-200">{copilot.recommendedNextStep}</p>
                      </div>
                      <div className="border-l border-white/10 py-1 pl-3">
                        <p className="text-xs text-slate-500">
                          {text("负责任披露提醒", "Responsible disclosure reminder")}
                        </p>
                        <p className="mt-2 text-sm text-slate-200">
                          {copilot.responsibleDisclosureReminder}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/8 p-3 text-sm text-cyan-100">
                      {text("本建议仅基于公开元数据，利用细节始终隐藏。", copilot.scopeStatement)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{copy.privacy.aiBoundary}</p>
                  </section>

                  <section className="surface-card rounded-lg p-5">
                    <h2 className="mb-4 text-base font-semibold text-white">{copy.triage.sections.timeline}</h2>
                    <div className="grid gap-3">
                      {timeline.map((action) => (
                        <div
                          className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                          key={action.id}
                        >
                          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <Clock3 size={14} aria-hidden="true" />
                            {copy.triage.workflow.actionLabels[action.actionType] ?? action.actionType}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">{text(getChineseProtocolValue(action.publicNote), action.publicNote)}</p>
                          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <FileText size={13} aria-hidden="true" />
                            {roleDisplayLabels[action.actorRole]} · {formatZhDateTime(action.createdAt)}
                          </p>
                        </div>
                      ))}
                      {timeline.length === 0 ? (
                        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
                          {copy.triage.noTimeline}
                        </p>
                      ) : null}
                    </div>
                  </section>
                </article>
              );
            })
          : null}
      </section>
        </>
      ) : null}
    </div>
  );
}

function WorkflowField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-cyan-100/60">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-white/10 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-cyan-100">{value}</p>
    </div>
  );
}
function getChineseVerificationLabel(verification: Parameters<typeof getVerificationLabel>[0]) {
  if (verification?.level === "NetworkConfirmed") return "Aleo 网络已确认";
  if (verification?.level === "RemoteExecution") return "远程 Leo 执行";
  if (verification?.level === "LocalExecution") return "本地 Leo 执行";
  if (verification?.level === "Simulation") return "模拟验证";
  return "验证暂不可用";
}

function getChineseVerificationStatement(verification: Parameters<typeof getVerificationStatement>[0]) {
  if (verification?.level === "NetworkConfirmed") return "证明：Aleo 网络已确认｜演示金库约束执行已确认，未绑定目标合约状态根。";
  if (verification?.level === "RemoteExecution") return "证明：远程 Leo 执行｜远程执行，尚非链上确认。";
  if (verification?.level === "LocalExecution") return "证明：本地 Leo 执行｜本地执行，尚非链上确认。";
  if (verification?.level === "Simulation") return "证明：模拟验证｜模拟验证，不是链上证明。";
  return "证明：暂不可用｜当前没有可验证的证明。";
}

function getChineseNetworkLabel(network: string | undefined) {
  if (network === "testnet") return "测试网";
  if (network === "mainnet") return "主网";
  if (network === "local") return "本地";
  return "暂不可用";
}

function getChineseImpactBand(severity: Parameters<typeof getImpactBand>[0]) {
  if (severity === "Critical") return "100+（严重程度下界）";
  if (severity === "High") return "50-99（高危区间）";
  if (severity === "Medium") return "10-49（中危区间）";
  return "0-9（低危区间）";
}
