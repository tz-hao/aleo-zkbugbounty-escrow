"use client";

import { AlertTriangle, Bot, CheckCircle2, Clock3, FileText, ReceiptText } from "lucide-react";
import { ClaimCard } from "@/components/claim-card";
import { DemoRolePreview } from "@/components/demo-role-preview";
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
import { zh } from "@/lib/i18n/zh";
import { formatZhDateTime } from "@/lib/format";
import { getClaimWorkflowGuidance } from "@/lib/state-machine";
import { getImpactBand, getVerificationLabel, getVerificationStatement } from "@/lib/proof-verification";

export default function TriagePage() {
  const { state } = useAppState();
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
        <p className="page-kicker mb-3 text-violet-200">{zh.triage.kicker}</p>
        <div>
          <div>
            <h1 className="gradient-heading text-3xl font-semibold tracking-normal sm:text-4xl">
              {zh.triage.title}
            </h1>
            <p className="muted-copy mt-3 max-w-2xl">
              {zh.triage.description}
            </p>
          </div>
        </div>
      </section>

      <DemoRolePreview />
      <RewardEscrowStatus />

      {!hasTriageAccess ? (
        <section className="surface-card rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 text-amber-200" size={20} aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                {zh.triage.noAccessTitle}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Public User 在本地 Triage Demo 中为只读。可在上方 Demo Preview 设置中切换演示视角；
                该设置不会改变钱包或链上权限。
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4">
        {hasTriageAccess && visibleClaims.length === 0 ? (
          <div className="glass-panel rounded-lg p-6 text-sm text-slate-400">
            {zh.triage.noClaims}
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
                        {zh.triage.sections.summary}
                      </h2>
                      <ClaimCard bounty={bounty} claim={claim} />
                    </div>
                    <div className="surface-card rounded-lg p-5">
                      <h2 className="mb-4 text-base font-semibold text-white">{zh.triage.sections.receipt}</h2>
                      <p className="mb-4 text-sm leading-6 text-slate-400">
                        Claim Receipt 记录公开 Proof Metadata；验证强度以 Verification Level 为准，不会泄露 Exploit。
                      </p>
                      <div className="grid gap-3 text-sm">
                        <ReceiptField label="Receipt ID" value={receipt?.receiptId ?? claim.receiptId} />
                        <ReceiptField label="Claim Hash" value={receipt?.claimHash ?? claim.claimHash} />
                        <ReceiptField label="Registry Key" value={claim.registryKey} />
                        <ReceiptField label="Witness Commitment" value={receipt?.witnessCommitment ?? claim.witnessCommitment} />
                        <ReceiptField label="Nullifier" value={receipt?.nullifier ?? claim.nullifier} />
                        <ReceiptField label="安全规则（Rule Name）" value={receipt?.ruleName ?? claim.ruleName} />
                        <div className="border-b border-white/10 py-3">
                          <p className="text-xs text-slate-500">
                            Proof Engine
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-slate-200">
                            <ReceiptText size={14} aria-hidden="true" />
                            Proof Engine: {receipt?.proofEngine ?? "Unknown"}
                          </p>
                        </div>
                        <ReceiptField label="Protocol Version" value={receipt?.protocolVersion.version ?? "Unknown"} />
                        <ReceiptField label="Verification Level" value={getVerificationLabel(receipt?.verification ?? claim.verification)} />
                        <ReceiptField label="Proof Statement" value={getVerificationStatement(receipt?.verification ?? claim.verification)} />
                        <ReceiptField label="Network" value={(receipt?.verification ?? claim.verification)?.network ?? "unavailable"} />
                        <ReceiptField label="Rule ID" value={receipt?.ruleId ?? bounty.ruleId} />
                        <ReceiptField label="受影响模块" value={receipt?.affectedModule ?? claim.affectedModule} />
                        <ReceiptField label="Invariant" value={bounty.ruleText} />
                        <ReceiptField label="Impact Band" value={getImpactBand(receipt?.severity ?? claim.severity)} />
                        <ReceiptField label="Severity" value={receipt?.severity ?? claim.severity} />
                        <ReceiptField label="Scope Hash" value={receipt?.scopeHash ?? bounty.scopeHash} />
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                    <div className="surface-card rounded-lg p-5">
                      <h2 className="mb-4 text-base font-semibold text-white">
                        {zh.triage.sections.disclosure}
                      </h2>
                      <p className="mb-4 max-w-2xl text-sm text-slate-400">
                        {zh.triage.privacyNotice}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-4">
                        {[
                          ["Proof", zh.status.proof[claim.proofStatus]],
                          ["奖励状态", zh.status.payout[claim.payoutStatus]],
                          ["披露状态", zh.status.disclosure[claim.disclosureStatus]],
                          ["Disclosure Package", packageState?.status ?? "尚未分享"],
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
                      <h2 className="mb-4 text-base font-semibold text-white">{zh.triage.sections.actions}</h2>
                      <div className="mb-4 grid gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] p-4 sm:grid-cols-3">
                        <WorkflowField
                          label={zh.triage.workflow.current}
                          value={zh.triage.workflow.stages[workflow.currentStage] ?? workflow.currentStage}
                        />
                        <WorkflowField
                          label={zh.triage.workflow.next}
                          value={workflow.nextAction ? zh.triage.workflow.actionLabels[workflow.nextAction] : zh.triage.workflow.final}
                        />
                        <WorkflowField
                          label={zh.triage.workflow.requiredRole}
                          value={workflow.requiredRole ? roleDisplayLabels[workflow.requiredRole] : zh.triage.workflow.none}
                        />
                        {workflow.blockedReason ? (
                          <p className="text-sm text-slate-300 sm:col-span-3">{zh.triage.workflow.terminalReason}</p>
                        ) : null}
                      </div>
                      <TriageActionControls bounty={bounty} claim={claim} />
                    </div>
                  </section>

                  {packageState ? (
                    <section className="surface-card rounded-lg p-5">
                      <h2 className="mb-4 text-base font-semibold text-white">{zh.triage.sections.audit}</h2>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ReceiptField label="Package Hash" value={packageState.packageHash} />
                        <ReceiptField label="Recipient Key ID" value={packageState.recipientKeyId} />
                        <ReceiptField label="Package Version" value={packageState.packageVersion} />
                        <ReceiptField label="加密方案" value={packageState.encryptionScheme} />
                        <ReceiptField label="交付状态" value={packageState.deliveryStatus} />
                        <ReceiptField label="有效期至" value={formatZhDateTime(packageState.expiresAt)} />
                      </div>
                    </section>
                  ) : null}

                  <section className="surface-card-strong rounded-lg p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Bot className="text-cyan-200" size={18} aria-hidden="true" />
                      <h2 className="text-base font-semibold text-white">{zh.triage.sections.copilot}</h2>
                      <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-400">
                        {localTriageCopilotProvider.name}
                      </span>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <div className="border-l border-white/10 py-1 pl-3">
                        <p className="text-xs text-slate-500">
                          风险摘要（Risk Summary）
                        </p>
                        <p className="mt-2 text-sm text-slate-200">{copilot.riskSummary}</p>
                      </div>
                      <div className="border-l border-white/10 py-1 pl-3">
                        <p className="text-xs text-slate-500">
                          建议下一步
                        </p>
                        <p className="mt-2 text-sm text-slate-200">{copilot.recommendedNextStep}</p>
                      </div>
                      <div className="border-l border-white/10 py-1 pl-3">
                        <p className="text-xs text-slate-500">
                          Responsible Disclosure 提醒
                        </p>
                        <p className="mt-2 text-sm text-slate-200">
                          {copilot.responsibleDisclosureReminder}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/8 p-3 text-sm text-cyan-100">
                      {copilot.scopeStatement}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{zh.privacy.aiBoundary}</p>
                  </section>

                  <section className="surface-card rounded-lg p-5">
                    <h2 className="mb-4 text-base font-semibold text-white">{zh.triage.sections.timeline}</h2>
                    <div className="grid gap-3">
                      {timeline.map((action) => (
                        <div
                          className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                          key={action.id}
                        >
                          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <Clock3 size={14} aria-hidden="true" />
                            {action.actionType}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">{action.publicNote}</p>
                          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <FileText size={13} aria-hidden="true" />
                            {roleDisplayLabels[action.actorRole]} · {formatZhDateTime(action.createdAt)}
                          </p>
                        </div>
                      ))}
                      {timeline.length === 0 ? (
                        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
                          {zh.triage.noTimeline}
                        </p>
                      ) : null}
                    </div>
                  </section>
                </article>
              );
            })
          : null}
      </section>
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
