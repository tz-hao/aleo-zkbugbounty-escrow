"use client";

import { useState, type FormEvent } from "react";
import { FileCheck2, Search, ShieldCheck } from "lucide-react";

import type { OnChainClaimReceipt } from "@/lib/models";

type LookupResponse = {
  receipt?: OnChainClaimReceipt;
  error?: string;
};

export function AleoClaimReceiptPanel() {
  const [claimHash, setClaimHash] = useState("");
  const [receipt, setReceipt] = useState<OnChainClaimReceipt | null>(null);
  const [message, setMessage] = useState("尚未查询 Aleo Testnet Claim Receipt。");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lookupKey = claimHash.trim();
    if (!/^[0-9]+field$/.test(lookupKey)) {
      setReceipt(null);
      setMessage("Claim Hash 必须是 Aleo field literal，例如 3518field。");
      return;
    }

    setLoading(true);
    setReceipt(null);
    setMessage("正在读取 Aleo Testnet claim_receipts mapping...");
    try {
      const response = await fetch(`/api/aleo/receipts/${encodeURIComponent(lookupKey)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json()) as LookupResponse;
      if (!response.ok || !payload.receipt) {
        setMessage(payload.error ?? "Claim Receipt 查询失败。");
        return;
      }
      setReceipt(payload.receipt);
      setMessage("已从 Aleo Testnet claim_receipts mapping 读取公开状态。");
    } catch {
      setMessage("无法连接 Aleo Testnet Claim Receipt 读取接口。");
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
            <p className="page-kicker">Aleo Testnet Claim Receipt</p>
          </div>
          <h2 id="aleo-claim-receipt-title" className="text-xl font-semibold text-white">
            独立核验链上 Claim Receipt
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            公开字段由 <span className="font-mono text-slate-300">submit_claim</span> Final
            原子写入。查询失败时不会使用 localStorage、Mock Receipt 或 Demo State 伪装链上结果。
          </p>
        </div>

        <form className="flex w-full max-w-xl flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="aleo-claim-hash">
            Aleo Claim Hash
          </label>
          <input
            id="aleo-claim-hash"
            className="input-surface focus-ring min-h-11 min-w-0 flex-1 rounded-lg px-3 font-mono text-sm"
            value={claimHash}
            onChange={(event) => setClaimHash(event.target.value)}
            placeholder="3518field"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="primary-action shrink-0" type="submit" disabled={loading}>
            <Search size={16} aria-hidden="true" />
            {loading ? "查询中" : "查询 Receipt"}
          </button>
        </form>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <ShieldCheck size={16} className="text-emerald-300" aria-hidden="true" />
          {message}
        </p>

        {receipt ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-emerald-100">
                Proof: {receipt.proofStatus}
              </span>
              <span className="rounded-md border border-red-300/25 bg-red-300/10 px-2 py-1 text-red-100">
                Severity: {receipt.severity}
              </span>
              <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-cyan-100">
                Source: {receipt.source}
              </span>
            </div>
            <dl className="mt-4 grid gap-x-8 border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
              <ReceiptRow label="Claim Hash" value={receipt.claimHash} mono />
              <ReceiptRow label="Bounty ID" value={receipt.bountyId} mono />
              <ReceiptRow label="Rule" value={receipt.ruleId} />
              <ReceiptRow label="Scope Hash" value={receipt.scopeHash} mono />
              <ReceiptRow label="Witness Commitment" value={receipt.witnessCommitment} mono />
              <ReceiptRow label="Nullifier" value={receipt.nullifier} mono />
              <ReceiptRow label="Reporter Commitment" value={receipt.reporterCommitment} mono />
              <ReceiptRow label="Created Height" value={String(receipt.createdHeight)} />
              <ReceiptRow label="Protocol Version" value={`v${receipt.protocolVersion}`} />
              <ReceiptRow label="Network" value={receipt.network} />
              <ReceiptRow label="Program" value={receipt.programId} mono />
              <ReceiptRow label="Mapping" value={receipt.mapping} mono />
            </dl>
            <div className="mt-4 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
              <p className="rounded-md border border-white/10 bg-white/[0.03] p-3">Exploit Details: Hidden</p>
              <p className="rounded-md border border-white/10 bg-white/[0.03] p-3">Private Witness: Never Stored</p>
              <p className="rounded-md border border-white/10 bg-white/[0.03] p-3">Proof: Publicly Verifiable</p>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function ReceiptRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-white/10 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 break-all text-sm text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
