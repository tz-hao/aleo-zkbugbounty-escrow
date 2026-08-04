"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CircleAlert, Copy, LoaderCircle, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";

import { ExecutionStatusBadge } from "@/components/execution-status-badge";
import { ProofStatusBadge, SeverityBadge } from "@/components/status-badge";
import type {
  OnChainClaimPayoutState,
  OnChainClaimReceipt,
  OnChainClaimTriageState,
} from "@/lib/models";
import { getVerificationStatement } from "@/lib/proof-verification";

type ReceiptState =
  | { kind: "loading" }
  | { kind: "found"; receipt: OnChainClaimReceipt }
  | { kind: "missing" }
  | { kind: "unavailable" };

type PaymentState =
  | { kind: "loading" }
  | {
      kind: "found";
      payout: OnChainClaimPayoutState | null;
      triage: OnChainClaimTriageState | null;
      reporterAddress: string | null;
    }
  | { kind: "not_started" }
  | { kind: "upgrade_required" }
  | { kind: "unavailable" };

async function fetchReceipt(claimHash: string): Promise<ReceiptState> {
  try {
    const response = await fetch(`/api/aleo/receipts/${encodeURIComponent(claimHash)}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404) return { kind: "missing" };
    const payload = await response.json() as { receipt?: OnChainClaimReceipt };
    if (!response.ok || !payload.receipt) return { kind: "unavailable" };
    return { kind: "found", receipt: payload.receipt };
  } catch {
    return { kind: "unavailable" };
  }
}

async function fetchPaymentState(claimHash: string): Promise<PaymentState> {
  try {
    const response = await fetch(`/api/aleo/triage/${encodeURIComponent(claimHash)}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 409) return { kind: "upgrade_required" };
    if (response.status === 404) return { kind: "not_started" };
    const payload = await response.json() as {
      payout?: OnChainClaimPayoutState | null;
      triage?: OnChainClaimTriageState | null;
      reporterAddress?: string | null;
    };
    if (!response.ok) return { kind: "unavailable" };
    return {
      kind: "found",
      payout: payload.payout ?? null,
      triage: payload.triage ?? null,
      reporterAddress: payload.reporterAddress ?? null,
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export default function PublicReceiptPage() {
  const params = useParams<{ registryKey: string }>();
  const claimHash = params.registryKey;
  const [state, setState] = useState<ReceiptState>({ kind: "loading" });
  const [paymentState, setPaymentState] = useState<PaymentState>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    void Promise.all([fetchReceipt(claimHash), fetchPaymentState(claimHash)]).then(
      ([nextState, nextPaymentState]) => {
        if (!active) return;
        setState(nextState);
        setPaymentState(nextPaymentState);
      },
    );
    return () => {
      active = false;
    };
  }, [claimHash]);

  if (state.kind !== "found") {
    return (
      <section className="surface-card-strong rounded-lg p-6">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm text-cyan-100" href="/public-claims">
          <ArrowLeft size={16} aria-hidden="true" /> 返回公开 Registry
        </Link>
        {state.kind === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
            正在读取 Aleo Testnet Claim Receipt...
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-1 text-amber-200" size={18} aria-hidden="true" />
            <div>
              <h1 className="text-xl font-semibold text-white">
                {state.kind === "missing" ? "未找到链上 Claim Receipt" : "公开 Registry 暂不可用"}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                页面不会使用 Mock Receipt 或 localStorage 作为替代结果。
              </p>
            </div>
          </div>
        )}
      </section>
    );
  }

  const { receipt } = state;
  return (
    <div className="grid gap-6">
      <section className="surface-card-strong rounded-lg p-6 sm:p-7">
        <Link className="mb-5 inline-flex items-center gap-2 text-sm text-cyan-100" href="/public-claims">
          <ArrowLeft size={16} aria-hidden="true" /> 返回公开 Registry
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <ExecutionStatusBadge kind="onchain" label="Aleo Mapping Verified" />
            <h1 className="mt-4 text-3xl font-semibold text-white">链上 Claim Receipt</h1>
            <p className="mt-2 break-all font-mono text-sm text-cyan-100">{receipt.claimHash}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={receipt.severity} />
            <ProofStatusBadge status={receipt.proofStatus} />
          </div>
        </div>
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <ReceiptText className="text-cyan-200" size={18} aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">公开协议字段</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CopyField label="Claim Hash" value={receipt.claimHash} />
          <CopyField label="Bounty ID" value={receipt.bountyId} />
          <CopyField label="Scope Hash" value={receipt.scopeHash} />
          <CopyField label="Rule" value={receipt.ruleId} />
          <CopyField label="Severity" value={receipt.severity} />
          <CopyField label="Witness Commitment" value={receipt.witnessCommitment} />
          <CopyField label="Nullifier" value={receipt.nullifier} />
          <CopyField label="Reporter Commitment" value={receipt.reporterCommitment} />
          <CopyField label="Protocol Version" value={String(receipt.protocolVersion)} />
          <CopyField label="Created Height" value={String(receipt.createdHeight)} />
          <CopyField label="Program ID" value={receipt.programId} />
          <CopyField label="Network" value={receipt.network} />
        </div>
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <ReceiptText className="text-emerald-200" size={18} aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">链上披露与支付</h2>
        </div>
        {paymentState.kind === "found" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <CopyField
              label="Reporter"
              value={paymentState.reporterAddress ?? "Mapping not found"}
            />
            <CopyField
              label="Disclosure Status"
              value={paymentState.triage?.status ?? "NotStarted"}
            />
            <CopyField
              label="Payout Status"
              value={paymentState.payout?.status ?? "Unfunded"}
            />
            <CopyField
              label="Reward"
              value={
                paymentState.payout
                  ? `${paymentState.payout.rewardAmount} microcredits`
                  : "Not locked"
              }
            />
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-400">
            {paymentState.kind === "loading"
              ? "正在读取公开 Mapping..."
              : paymentState.kind === "upgrade_required"
                ? "Program Upgrade Required｜当前 Testnet 尚未启用 Credits Escrow。"
                : paymentState.kind === "not_started"
                  ? "尚未产生链上 Escrow 或 Triage 状态。"
                  : "暂时无法核验支付 Mapping；不会使用本地状态替代。"}
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <PublicBoundary label="Exploit Details" value="Hidden" />
        <PublicBoundary label="Private Witness" value="Never Stored" />
        <PublicBoundary
          label="Proof Scope"
          value={getVerificationStatement({
            level: "NetworkConfirmed",
            network: "testnet",
            programId: receipt.programId,
          })}
        />
      </section>
    </div>
  );
}

function PublicBoundary({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card rounded-lg p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-cyan-100">{value}</p>
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
    <div className="min-w-0 border-b border-white/10 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{label}</p>
        <button
          aria-label={`复制 ${label}`}
          className="focus-ring flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
          onClick={copyValue}
          type="button"
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </div>
      <p className="mt-2 break-all font-mono text-sm text-cyan-100">{value}</p>
    </div>
  );
}
