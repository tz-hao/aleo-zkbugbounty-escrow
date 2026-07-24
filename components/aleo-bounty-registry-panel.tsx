"use client";

import { Database, Search, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

import type { OnChainBountyState } from "@/lib/models";

type LookupResponse = {
  bounty?: OnChainBountyState;
  error?: string;
};

export function AleoBountyRegistryPanel() {
  const [bountyId, setBountyId] = useState("");
  const [bounty, setBounty] = useState<OnChainBountyState | null>(null);
  const [message, setMessage] = useState("尚未查询 Aleo Testnet mapping。");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lookupId = bountyId.trim();
    if (!/^[0-9]+field$/.test(lookupId)) {
      setBounty(null);
      setMessage("Bounty ID 必须是 Aleo field literal，例如 5001field。");
      return;
    }

    setLoading(true);
    setBounty(null);
    setMessage("正在读取 Aleo Testnet...");
    try {
      const response = await fetch(`/api/aleo/bounties/${encodeURIComponent(lookupId)}`, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      const payload = (await response.json()) as LookupResponse;
      if (!response.ok || !payload.bounty) {
        setMessage(payload.error ?? "Aleo Registry 查询失败。");
        return;
      }
      setBounty(payload.bounty);
      setMessage("已从 Aleo Testnet bounties mapping 读取公开状态。");
    } catch {
      setMessage("无法连接 Aleo Registry 读取接口。");
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
            <p className="page-kicker">Aleo Testnet Registry</p>
          </div>
          <h2 id="aleo-bounty-registry-title" className="text-xl font-semibold text-white">
            查询链上 Bounty 状态
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
          仅查询已部署 Program 的公开 mapping。未找到对应 key 时会明确返回空，不会回退到 localStorage Demo State。
          </p>
        </div>

        <form className="flex w-full max-w-xl flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="aleo-bounty-id">
            Aleo Bounty ID
          </label>
          <input
            id="aleo-bounty-id"
            className="input-surface focus-ring min-h-11 min-w-0 flex-1 rounded-lg px-3 font-mono text-sm"
            value={bountyId}
            onChange={(event) => setBountyId(event.target.value)}
            placeholder="5001field"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="primary-action shrink-0" type="submit" disabled={loading}>
            <Search size={16} aria-hidden="true" />
            {loading ? "查询中" : "查询 mapping"}
          </button>
        </form>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <ShieldCheck size={16} className="text-emerald-300" aria-hidden="true" />
          {message}
        </p>

        {bounty ? (
          <dl className="mt-4 grid gap-x-8 border-t border-white/10 sm:grid-cols-2 lg:grid-cols-3">
            <RegistryRow label="Owner" value={bounty.owner} mono />
            <RegistryRow label="Status" value={bounty.status} />
            <RegistryRow label="Rule" value={bounty.ruleId} />
            <RegistryRow label="Scope Hash" value={bounty.scopeHash} mono />
            <RegistryRow label="Critical Reward" value={`${bounty.rewards.critical} microcredits`} />
            <RegistryRow label="High Reward" value={`${bounty.rewards.high} microcredits`} />
            <RegistryRow label="Medium Reward" value={`${bounty.rewards.medium} microcredits`} />
            <RegistryRow label="Low Reward" value={`${bounty.rewards.low} microcredits`} />
            <RegistryRow label="Deadline Height" value={String(bounty.disclosureDeadline)} />
            <RegistryRow label="Program" value={bounty.programId} mono />
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function RegistryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-b border-white/10 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 break-all text-sm text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
