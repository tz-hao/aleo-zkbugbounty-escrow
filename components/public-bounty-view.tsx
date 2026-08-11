"use client";

import { ArrowUpRight, CircleAlert, Database, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getOnChainBountyOperationalStatus } from "@/lib/aleo-bounty-registry";
import type { OnChainBountyState } from "@/lib/models";
import { getChineseProtocolValue } from "@/lib/i18n/zh";
import { useLocale } from "./locale-provider";

type LookupState =
  | { kind: "loading" }
  | { kind: "found"; bounty: OnChainBountyState; currentHeight: number | null }
  | { kind: "missing"; message: string }
  | { kind: "unavailable"; message: string };

async function fetchPublicBounty(bountyId: string): Promise<LookupState> {
  try {
    const [response, networkResponse] = await Promise.all([
      fetch(`/api/aleo/bounties/${encodeURIComponent(bountyId)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      }),
      fetch("/api/aleo/network", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      }),
    ]);
    const payload = (await response.json()) as { bounty?: OnChainBountyState; error?: string };
    const networkPayload = networkResponse.ok
      ? await networkResponse.json() as { network?: { latestHeight?: number } }
      : null;
    if (response.status === 404) {
      return { kind: "missing", message: "Aleo Testnet bounties mapping 中未找到该 Bounty。" };
    }
    if (!response.ok || !payload.bounty) {
      return { kind: "unavailable", message: payload.error ?? "Aleo Testnet 查询不可用。" };
    }
    const latestHeight = networkPayload?.network?.latestHeight;
    return {
      kind: "found",
      bounty: payload.bounty,
      currentHeight: Number.isSafeInteger(latestHeight) ? latestHeight! : null,
    };
  } catch {
    return { kind: "unavailable", message: "无法连接公开 Aleo Testnet Registry。" };
  }
}

export function PublicBountyView({ bountyId }: { bountyId: string }) {
  const { text } = useLocale();
  const [state, setState] = useState<LookupState>({ kind: "loading" });

  async function load() {
    setState({ kind: "loading" });
    setState(await fetchPublicBounty(bountyId));
  }

  useEffect(() => {
    let active = true;
    void fetchPublicBounty(bountyId).then((nextState) => {
      if (active) setState(nextState);
    });
    return () => {
      active = false;
    };
  }, [bountyId]);

  return (
    <div className="grid gap-6">
      <section className="surface-card-strong rounded-lg p-6 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">{text("Aleo 测试网查询", "Aleo Testnet query")}</span>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300">{text("数据来源：Aleo 测试网公开映射", "Data Source: Aleo Testnet Public Mapping")}</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">{text("公开赏金注册表", "Public Bounty Registry")}</h1>
        <p className="mt-3 break-all font-mono text-sm text-cyan-100">{bountyId}</p>
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6" aria-live="polite">
        {state.kind === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-slate-300"><LoaderCircle className="animate-spin text-cyan-200" size={16} aria-hidden="true" />{text("正在读取测试网映射…", "Reading Testnet mapping...")}</p>
        ) : state.kind === "found" ? (
          <BountyFacts bounty={state.bounty} currentHeight={state.currentHeight} />
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="flex items-start gap-2 text-sm leading-6 text-amber-100"><CircleAlert className="mt-1 shrink-0" size={16} aria-hidden="true" />{text(state.message, state.kind === "missing" ? "The Bounty was not found in the Aleo Testnet Mapping." : "The public Aleo Testnet registry is temporarily unavailable.")}</p>
            <button className="focus-ring secondary-action" type="button" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" />{text("重新查询", "Query again")}</button>
          </div>
        )}
      </section>
    </div>
  );
}

function BountyFacts({
  bounty,
  currentHeight,
}: {
  bounty: OnChainBountyState;
  currentHeight: number | null;
}) {
  const { text } = useLocale();
  const operationalStatus = currentHeight === null
    ? bounty.status
    : getOnChainBountyOperationalStatus(bounty, currentHeight);
  const acceptsClaims = operationalStatus === "Active";
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><ShieldCheck size={16} aria-hidden="true" />{text("映射已找到", "Mapping found")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{text("链上赏金状态", "On-chain Bounty state")}</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs text-cyan-100"><Database size={14} aria-hidden="true" />{bounty.mapping}</span>
      </div>
      <dl className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <PublicFact label={text("所有者", "Owner")} value={bounty.owner} />
        <PublicFact label={text("链上状态", "On-chain status")} value={bounty.status} />
        <PublicFact label={text("运行状态", "Operational status")} value={operationalStatus} />
        <PublicFact label={text("规则编号", "Rule ID")} value={bounty.ruleId} />
        <PublicFact label={text("范围哈希", "Scope hash")} value={bounty.scopeHash} />
        <PublicFact label={text("严重级奖励", "Critical reward")} value={`${bounty.rewards.critical} microcredits`} />
        <PublicFact label={text("高危奖励", "High reward")} value={`${bounty.rewards.high} microcredits`} />
        <PublicFact label={text("中危奖励", "Medium reward")} value={`${bounty.rewards.medium} microcredits`} />
        <PublicFact label={text("低危奖励", "Low reward")} value={text("不可领取（影响值 0-9）", "Not claimable (0-9 impact)")} />
        <PublicFact label={text("披露截止高度", "Disclosure deadline")} value={String(bounty.disclosureDeadline)} />
        <PublicFact label={text("当前区块高度", "Current height")} value={currentHeight === null ? text("暂不可用", "Unavailable") : String(currentHeight)} />
        <PublicFact label={text("程序编号", "Program ID")} value={bounty.programId} />
        <PublicFact label={text("网络", "Network")} value={text(getChineseProtocolValue(bounty.network), bounty.network)} />
        <PublicFact label={text("数据来源", "Data source")} value={bounty.source} />
      </dl>
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap gap-3">
          <Link className="focus-ring secondary-action w-fit" href="/public-claims">{text("打开公开注册表", "Open Public Registry Console")}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link
            aria-disabled={!acceptsClaims}
            className={`focus-ring primary-action w-fit ${acceptsClaims ? "" : "pointer-events-none opacity-40"}`}
            href={`/submit-proof?bountyId=${encodeURIComponent(bounty.bountyId)}`}
          >
            {acceptsClaims ? text("提交钱包签名漏洞声明", "Submit Wallet-signed Claim") : text("赏金不再接受漏洞声明", "Bounty no longer accepts Claims")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}

function PublicFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-white/10 py-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-all font-mono text-sm text-slate-200">{value}</dd></div>;
}
