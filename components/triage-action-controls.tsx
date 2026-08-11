"use client";

import { useState } from "react";
import { Check, FileText, Lock, Send, ShieldCheck, ShieldX, Wrench } from "lucide-react";
import type { ActionType, Bounty, BugClaim } from "@/lib/models";
import {
  canAddTriageNote,
  canLockReward,
  canMarkPatched,
  canRejectClaim,
  canReleaseBounty,
  canRequestEncryptedDetails,
} from "@/lib/permissions";
import { useAppState } from "./app-state-provider";
import { EncryptedDisclosureWorkbench } from "./encrypted-disclosure-workbench";
import { useLocale } from "./locale-provider";

export function TriageActionControls({ claim, bounty }: { claim: BugClaim; bounty: Bounty }) {
  const { state, dispatch } = useAppState();
  const { copy, text } = useLocale();
  const actor = state.currentActor;
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);
  const [feedback, setFeedback] = useState("");

  const ownerActions = [
    {
      actionType: "RewardLocked" as const,
      label: `${copy.triage.actions.lock} (${text("本地演示状态", "Demo state")})`,
      icon: Lock,
      enabled: canLockReward(actor, bounty, claim),
    },
    {
      actionType: "DetailsRequested" as const,
      label: copy.triage.actions.request,
      icon: Send,
      enabled: canRequestEncryptedDetails(actor, bounty, claim),
    },
    {
      actionType: "Patched" as const,
      label: copy.triage.actions.patched,
      icon: Wrench,
      enabled: canMarkPatched(actor, bounty, claim),
    },
    {
      actionType: "Paid" as const,
      label: `${copy.triage.actions.paid} (${text("本地演示状态", "Demo state")})`,
      icon: Check,
      enabled: canReleaseBounty(actor, bounty, claim),
    },
    {
      actionType: "Rejected" as const,
      label: copy.triage.actions.rejected,
      icon: ShieldX,
      enabled: canRejectClaim(actor, bounty, claim),
    },
  ];

  function submitNote() {
    if (!note.trim()) {
      return;
    }
    dispatch({ type: "addTriageNote", claimId: claim.id, publicNote: note.trim() });
    setNote("");
    setFeedback(text("公开备注已添加。", "Public note added."));
  }

  function recommendSeverity() {
    dispatch({
      type: "addTriageNote",
      claimId: claim.id,
      publicNote: text(`安全仲裁者建议严重程度：${copy.status.severity[claim.severity]}。`, `Security Arbiter recommends severity: ${claim.severity}.`),
    });
    setFeedback(text("严重程度建议已添加到公开分诊时间线。", "Severity recommendation added to the public triage timeline."));
  }

  function runOwnerAction(actionType: ActionType) {
    dispatch({ type: "triage", claimId: claim.id, actionType });
    setPendingAction(null);
    setFeedback(text(`${copy.triage.workflow.actionLabels[actionType]}状态已更新；当前未提交链上交易。`, `${actionType} status updated; no on-chain transaction was submitted.`));
  }

  function requestOwnerAction(actionType: ActionType) {
    if (actionType === "Paid" || actionType === "Rejected") {
      setPendingAction(actionType);
      return;
    }
    runOwnerAction(actionType);
  }

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
        {text("当前角色、奖励锁定、支付与披露交付均为本地演示状态；没有钱包签名、托管转账或密文托管。", "Current role, reward lock, payout, and disclosure delivery are local Demo State only. There is no Wallet signature, Escrow transfer, or ciphertext custody.")}
      </p>
      {actor.role === "ProjectOwner" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {ownerActions.map(({ actionType, label, enabled, icon: Icon }) => (
            <button
              className={`focus-ring inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                enabled
                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/16"
                  : "cursor-not-allowed border-white/8 bg-white/[0.02] text-slate-600"
              }`}
              disabled={!enabled}
              key={actionType}
              onClick={() => requestOwnerAction(actionType)}
              type="button"
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {pendingAction ? (
        <div className="rounded-lg border border-red-300/25 bg-red-500/10 p-4" role="alertdialog" aria-modal="true">
          <p className="font-semibold text-red-100">
            {copy.triage.confirmFinal}
          </p>
          <p className="mt-1 text-sm text-slate-300">{copy.triage.confirmFinalBody}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="focus-ring min-h-11 rounded-lg border border-red-300/35 bg-red-500/15 px-4 text-sm font-semibold text-red-100" onClick={() => runOwnerAction(pendingAction)} type="button">
              {copy.common.confirm}
            </button>
            <button className="focus-ring secondary-action" onClick={() => setPendingAction(null)} type="button">
              {copy.common.cancel}
            </button>
          </div>
        </div>
      ) : null}

      <EncryptedDisclosureWorkbench key={`${actor.id}:${claim.id}`} claim={claim} />

      {canAddTriageNote(actor, claim) ? (
        <div className="grid gap-2">
          {actor.role === "TriageArbiter" ? (
            <button
              className="focus-ring secondary-action w-fit"
              onClick={recommendSeverity}
              type="button"
            >
              <ShieldCheck size={16} aria-hidden="true" />
              {copy.triage.actions.recommend}
            </button>
          ) : null}
          <textarea
            className="focus-ring input-surface min-h-20 rounded-lg px-3 py-3 text-sm"
            onChange={(event) => setNote(event.target.value)}
            placeholder={copy.triage.actions.notePlaceholder}
            value={note}
          />
          <button
            className="focus-ring secondary-action w-fit border-violet-300/30 bg-violet-300/10 text-violet-100"
            onClick={submitNote}
            type="button"
          >
            <FileText size={16} aria-hidden="true" />
            {copy.triage.actions.addNote}
          </button>
        </div>
      ) : null}

      {actor.role === "PublicUser" ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-400">
          {copy.triage.publicNoActions}
        </p>
      ) : null}
      <p aria-live="polite" className="min-h-5 text-sm text-emerald-200">{feedback}</p>
    </div>
  );
}
