"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleAlert, Copy, LoaderCircle, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";

import { ExecutionStatusBadge } from "@/components/execution-status-badge";
import { PublicReceiptBoundary } from "@/components/public-receipt-boundary";
import { ProofStatusBadge, SeverityBadge } from "@/components/status-badge";
import type {
  OnChainClaimPayoutState,
  OnChainClaimReceipt,
  OnChainClaimTriageState,
} from "@/lib/models";
import { useLocale } from "@/components/locale-provider";
import { getVerificationStatement } from "@/lib/proof-verification";
import { getChineseProtocolValue } from "@/lib/i18n/zh";

function getChineseTriageStatus(status?: OnChainClaimTriageState["status"]) {
  if (!status) return "尚未开始";
  const labels: Record<OnChainClaimTriageState["status"], string> = {
    RewardLocked: "奖励已锁定",
    DetailsRequested: "已请求加密细节",
    EncryptedDetailsShared: "已分享加密细节",
    Patched: "已修复",
    Paid: "已支付",
    Rejected: "已拒绝",
  };
  return labels[status];
}

function getChinesePayoutStatus(status?: OnChainClaimPayoutState["status"]) {
  if (!status) return "尚未充值";
  if (status === "RewardLocked") return "奖励已锁定";
  if (status === "Paid") return "已支付";
  return "已拒绝";
}
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
  const { text } = useLocale();
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
          <ArrowLeft size={16} aria-hidden="true" /> {text("返回公开注册表", "Back to Public Registry")}
        </Link>
        {state.kind === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
            {text("正在读取 Aleo 测试网漏洞声明收据…", "Reading the Aleo Testnet Claim Receipt...")}
          </p>
        ) : (
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-1 text-amber-200" size={18} aria-hidden="true" />
            <div>
              <h1 className="text-xl font-semibold text-white">
                {state.kind === "missing" ? text("未找到链上漏洞声明收据", "On-chain Claim Receipt not found") : text("公开注册表暂不可用", "Public Registry is temporarily unavailable")}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                {text("页面不会使用模拟收据或本地存储作为替代结果。", "This page does not use a Mock Receipt or localStorage as a substitute.")}
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
          <ArrowLeft size={16} aria-hidden="true" /> {text("返回公开注册表", "Back to Public Registry")}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <ExecutionStatusBadge kind="onchain" label={text("Aleo 映射已验证", "Aleo Mapping Verified")} />
            <h1 className="mt-4 text-3xl font-semibold text-white">{text("链上漏洞声明收据", "On-chain Claim Receipt")}</h1>
            <p className="mt-2 break-all font-mono text-sm text-cyan-100">{receipt.claimHash}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={receipt.severity} />
            <ProofStatusBadge status={receipt.proofStatus} />
            {receipt.protocolVersion >= 2 ? (
              <Link className="primary-action" href={`/triage?claimHash=${encodeURIComponent(receipt.claimHash)}`}>
                {text("进入链上分诊", "Open on-chain triage")}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <ReceiptText className="text-cyan-200" size={18} aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">{text("公开协议字段", "Public protocol fields")}</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CopyField label={text("声明哈希", "Claim Hash")} value={receipt.claimHash} />
          <CopyField label={text("赏金编号", "Bounty ID")} value={receipt.bountyId} />
          <CopyField label={text("范围哈希", "Scope Hash")} value={receipt.scopeHash} />
          <CopyField label={text("安全规则", "Rule")} value={receipt.ruleId} />
          <CopyField label={text("严重程度", "Severity")} value={receipt.severity} />
          <CopyField label={text("见证承诺", "Witness Commitment")} value={receipt.witnessCommitment} />
          <CopyField label={text("防重复标识", "Nullifier")} value={receipt.nullifier} />
          <CopyField label={text("报告者承诺", "Reporter Commitment")} value={receipt.reporterCommitment} />
          <CopyField label={text("协议版本", "Protocol Version")} value={String(receipt.protocolVersion)} />
          <CopyField label={text("创建区块高度", "Created Height")} value={String(receipt.createdHeight)} />
          <CopyField label={text("程序编号", "Program ID")} value={receipt.programId} />
          <CopyField label={text("网络", "Network")} value={text(getChineseProtocolValue(receipt.network), receipt.network)} />
        </div>
        <PublicReceiptBoundary receipt={receipt} />
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <ReceiptText className="text-emerald-200" size={18} aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">{text("链上披露与支付", "On-chain disclosure and payout")}</h2>
        </div>
        {paymentState.kind === "found" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <CopyField
              label={text("报告者", "Reporter")}
              value={paymentState.reporterAddress ?? text("未找到映射", "Mapping not found")}
            />
            <CopyField
              label={text("披露状态", "Disclosure Status")}
              value={text(getChineseTriageStatus(paymentState.triage?.status), paymentState.triage?.status ?? "Not started")}
            />
            <CopyField
              label={text("支付状态", "Payout Status")}
              value={text(getChinesePayoutStatus(paymentState.payout?.status), paymentState.payout?.status ?? "Unfunded")}
            />
            <CopyField
              label={text("奖励金额", "Reward")}
              value={
                paymentState.payout
                  ? `${paymentState.payout.rewardAmount} microcredits`
                  : text("尚未锁定", "Not locked")
              }
            />
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-400">
            {paymentState.kind === "loading"
              ? text("正在读取公开映射…", "Reading public Mapping...")
              : paymentState.kind === "upgrade_required"
                ? text("需要程序升级｜当前测试网版本尚未启用 Credits 托管。", "Program Upgrade Required | Credits Escrow is not enabled on the current Testnet edition.")
                : paymentState.kind === "not_started"
                  ? text("尚未产生链上托管或分诊状态。", "No on-chain Escrow or Triage state has been created.")
                  : text("暂时无法核验支付映射；不会使用本地状态替代。", "The payout Mapping cannot be verified right now; there is no local-state substitute.")}
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <PublicBoundary label={text("利用细节", "Exploit Details")} value={text("已隐藏", "Hidden")} />
        <PublicBoundary label={text("私有见证", "Private Witness")} value={text("从未保存", "Never Stored")} />
        <PublicBoundary
          label={text("证明范围", "Proof Scope")}
          value={text(
            "证明：Aleo 网络已确认｜DemoVault 约束执行已确认，未绑定目标合约状态根",
            getVerificationStatement({
              level: "NetworkConfirmed",
              network: "testnet",
              programId: receipt.programId,
            }),
          )}
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
  const { text } = useLocale();
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
          aria-label={text(`复制 ${label}`, `Copy ${label}`)}
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
