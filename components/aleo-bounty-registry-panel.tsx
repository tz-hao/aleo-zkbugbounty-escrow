"use client";

import { Database, Search, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { OnChainBountyState } from "@/lib/models";
import { useLocale } from "./locale-provider";

type LookupResponse = { bounty?: OnChainBountyState; error?: string };

function bountyStatusLabel(status: OnChainBountyState["status"], text: (chinese: string, english: string) => string) {
  if (status === "Active") return text("进行中", "Active");
  if (status === "Paused") return text("已暂停", "Paused");
  return text("已关闭", "Closed");
}

export function AleoBountyRegistryPanel() {
  const { text } = useLocale();
  const [bountyId, setBountyId] = useState("");
  const [bounty, setBounty] = useState<OnChainBountyState | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const visibleMessage = message || text("尚未查询 Aleo 测试网赏金映射。", "No Aleo Testnet Bounty mapping has been queried yet.");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lookupId = bountyId.trim();
    if (!/^[0-9]+field$/.test(lookupId)) {
      setBounty(null);
      setMessage(text("赏金编号必须是 Aleo field 字面量，例如 5001field。", "Bounty ID must be an Aleo field literal, for example 5001field."));
      return;
    }

    setLoading(true);
    setBounty(null);
    setMessage(text("正在读取 Aleo 测试网…", "Reading Aleo Testnet..."));
    try {
      const response = await fetch(`/api/aleo/bounties/${encodeURIComponent(lookupId)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const payload = (await response.json()) as LookupResponse;
      if (!response.ok || !payload.bounty) {
        setMessage(payload.error ?? text("链上赏金注册表查询失败。", "Aleo Bounty Registry query failed."));
        return;
      }
      setBounty(payload.bounty);
      setMessage(text("已从 Aleo 测试网赏金映射读取公开状态。", "Public state was read from the Aleo Testnet bounties mapping."));
    } catch {
      setMessage(text("无法连接链上赏金注册表读取接口。", "Unable to connect to the Aleo Bounty Registry endpoint."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-labelledby="aleo-bounty-registry-title">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-cyan-200">
            <Database size={17} aria-hidden="true" />
            <p className="page-kicker">{text("Aleo 测试网注册表", "Aleo Testnet Registry")}</p>
          </div>
          <h2 id="aleo-bounty-registry-title" className="text-xl font-semibold text-white">
            {text("查询链上赏金状态", "Query on-chain Bounty state")}
          </h2>
        </div>
        <form className="flex w-full max-w-xl flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="aleo-bounty-id">{text("赏金编号", "Aleo Bounty ID")}</label>
          <input
            id="aleo-bounty-id"
            className="input-surface focus-ring min-h-11 min-w-0 flex-1 rounded-lg px-3 font-mono text-sm"
            value={bountyId}
            onChange={(event) => setBountyId(event.target.value)}
            placeholder="5001field"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="secondary-action shrink-0" type="submit" disabled={loading}>
            <Search size={16} aria-hidden="true" />
            {loading ? text("查询中", "Querying") : text("查询映射", "Query mapping")}
          </button>
        </form>
      </div>
      <div className="mt-5 border-t border-white/10 pt-4" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <ShieldCheck size={16} className={bounty ? "text-emerald-300" : "text-slate-500"} aria-hidden="true" />
          {visibleMessage}
        </p>
        {bounty ? (
          <dl className="mt-4 grid gap-x-8 border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
            <RegistryRow label={text("所有者", "Owner")} value={bounty.owner} mono />
            <RegistryRow label={text("链上状态", "On-chain status")} value={bountyStatusLabel(bounty.status, text)} />
            <RegistryRow label={text("规则编号", "Rule ID")} value={bounty.ruleId} />
            <RegistryRow label={text("范围哈希", "Scope hash")} value={bounty.scopeHash} mono />
            <RegistryRow label={text("严重级奖励", "Critical reward")} value={`${bounty.rewards.critical} microcredits`} />
            <RegistryRow label={text("高危奖励", "High reward")} value={`${bounty.rewards.high} microcredits`} />
            <RegistryRow label={text("中危奖励", "Medium reward")} value={`${bounty.rewards.medium} microcredits`} />
            <RegistryRow label={text("低危奖励", "Low reward")} value={`${bounty.rewards.low} microcredits`} />
            <RegistryRow label={text("披露截止区块高度", "Disclosure deadline height")} value={String(bounty.disclosureDeadline)} />
            <RegistryRow label={text("程序编号", "Program ID")} value={bounty.programId} mono />
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function RegistryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="border-b border-white/10 py-3"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 break-all text-sm text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}