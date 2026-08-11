"use client";

import { FileCheck2, Search, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { OnChainClaimReceipt } from "@/lib/models";
import { getChineseProtocolValue } from "@/lib/i18n/zh";
import { PublicReceiptBoundary } from "./public-receipt-boundary";
import { useLocale } from "./locale-provider";

type LookupResponse = { receipt?: OnChainClaimReceipt; error?: string };

function proofStatusLabel(status: OnChainClaimReceipt["proofStatus"], text: (chinese: string, english: string) => string) {
  return status === "Verified" ? text("已验证", "Verified") : text("无效", "Invalid");
}

function severityLabel(severity: OnChainClaimReceipt["severity"], text: (chinese: string, english: string) => string) {
  const labels = { Critical: ["严重", "Critical"], High: ["高危", "High"], Medium: ["中危", "Medium"] } as const;
  const [chinese, english] = labels[severity];
  return text(chinese, english);
}

export function AleoClaimReceiptPanel() {
  const { text } = useLocale();
  const [claimHash, setClaimHash] = useState("");
  const [receipt, setReceipt] = useState<OnChainClaimReceipt | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const visibleMessage = message || text("尚未查询 Aleo 测试网漏洞声明收据。", "No Aleo Testnet Claim Receipt has been queried yet.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lookupKey = claimHash.trim();
    if (!/^[0-9]+field$/.test(lookupKey)) {
      setReceipt(null);
      setMessage(text("声明哈希必须是 Aleo field 字面量，例如 3518field。", "Claim hash must be an Aleo field literal, for example 3518field."));
      return;
    }

    setLoading(true);
    setReceipt(null);
    setMessage(text("正在读取 Aleo 测试网漏洞声明收据映射…", "Reading the Aleo Testnet claim_receipts mapping..."));
    try {
      const response = await fetch(`/api/aleo/receipts/${encodeURIComponent(lookupKey)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json()) as LookupResponse;
      if (!response.ok || !payload.receipt) {
        setMessage(payload.error ?? text("漏洞声明收据查询失败。", "Claim Receipt query failed."));
        return;
      }
      setReceipt(payload.receipt);
      setMessage(text("已从 Aleo 测试网漏洞声明收据映射读取公开状态。", "Public state was read from the Aleo Testnet claim_receipts mapping."));
    } catch {
      setMessage(text("无法连接漏洞声明收据读取接口。", "Unable to connect to the Aleo Testnet Claim Receipt endpoint."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-labelledby="aleo-claim-receipt-title">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-violet-200">
            <FileCheck2 size={17} aria-hidden="true" />
            <p className="page-kicker">{text("Aleo 测试网漏洞声明收据", "Aleo Testnet Claim Receipt")}</p>
          </div>
          <h2 id="aleo-claim-receipt-title" className="text-xl font-semibold text-white">
            {text("独立核验链上漏洞声明收据", "Independently verify an on-chain Claim Receipt")}
          </h2>
        </div>
        <form className="flex w-full max-w-xl flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="aleo-claim-hash">{text("声明哈希", "Aleo Claim Hash")}</label>
          <input
            id="aleo-claim-hash"
            className="input-surface focus-ring min-h-11 min-w-0 flex-1 rounded-lg px-3 font-mono text-sm"
            value={claimHash}
            onChange={(event) => setClaimHash(event.target.value)}
            placeholder="3518field"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="secondary-action shrink-0" type="submit" disabled={loading}>
            <Search size={16} aria-hidden="true" />
            {loading ? text("查询中", "Querying") : text("查询收据", "Query receipt")}
          </button>
        </form>
      </div>
      <div className="mt-5 border-t border-white/10 pt-4" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <ShieldCheck size={16} className={receipt ? "text-emerald-300" : "text-slate-500"} aria-hidden="true" />
          {visibleMessage}
        </p>
        {receipt ? <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-emerald-100">{text("证明", "Proof")}: {proofStatusLabel(receipt.proofStatus, text)}</span>
            <span className="rounded-md border border-red-300/25 bg-red-300/10 px-2 py-1 text-red-100">{text("严重程度", "Severity")}: {severityLabel(receipt.severity, text)}</span>
            <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-cyan-100">{text("数据来源", "Source")}: {receipt.source}</span>
          </div>
          <PublicReceiptBoundary receipt={receipt} />
          <dl className="mt-4 grid gap-x-8 border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
            <ReceiptRow label={text("声明哈希", "Claim hash")} value={receipt.claimHash} mono />
            <ReceiptRow label={text("赏金编号", "Bounty ID")} value={receipt.bountyId} mono />
            <ReceiptRow label={text("规则编号", "Rule ID")} value={receipt.ruleId} />
            <ReceiptRow label={text("范围哈希", "Scope hash")} value={receipt.scopeHash} mono />
            <ReceiptRow label={text("见证承诺", "Witness commitment")} value={receipt.witnessCommitment} mono />
            <ReceiptRow label={text("防重复标识", "Nullifier")} value={receipt.nullifier} mono />
            <ReceiptRow label={text("报告者承诺", "Reporter commitment")} value={receipt.reporterCommitment} mono />
            <ReceiptRow label={text("创建区块高度", "Created height")} value={String(receipt.createdHeight)} />
            <ReceiptRow label={text("协议版本", "Protocol version")} value={`v${receipt.protocolVersion}`} />
            <ReceiptRow label={text("网络", "Network")} value={text(getChineseProtocolValue(receipt.network), receipt.network)} />
            <ReceiptRow label={text("程序编号", "Program ID")} value={receipt.programId} mono />
            <ReceiptRow label={text("映射名称", "Mapping")} value={receipt.mapping} mono />
          </dl>
          <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
            <p className="rounded-md border border-white/10 bg-white/[0.03] p-3">{text("利用细节：已隐藏", "Exploit Details: Hidden")}</p>
            <p className="rounded-md border border-white/10 bg-white/[0.03] p-3">{text("私有见证：从未保存", "Private Witness: Never Stored")}</p>
            <p className="rounded-md border border-white/10 bg-white/[0.03] p-3">{text("证明：可公开验证", "Proof: Publicly Verifiable")}</p>
          </div>
        </> : null}
      </div>
    </section>
  );
}

function ReceiptRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="border-b border-white/10 py-3"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 break-all text-sm text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}