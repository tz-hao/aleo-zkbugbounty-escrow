"use client";

import { CheckCircle2, Database, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useLocale } from "@/components/locale-provider";
import type { AleoPublicIndexPage } from "@/lib/aleo-public-index";
import { ExecutionStatusBadge } from "./execution-status-badge";

type BountyPage = Extract<AleoPublicIndexPage, { kind: "bounties" }>;
type ClaimPage = Extract<AleoPublicIndexPage, { kind: "claims" }>;

type RegistryState =
  | { kind: "loading" }
  | { kind: "loaded"; bounties: BountyPage; claims: ClaimPage }
  | { kind: "unavailable" };

async function fetchRegistry(kind: "bounties" | "claims", signal: AbortSignal): Promise<AleoPublicIndexPage> {
  const response = await fetch(`/api/aleo/registry?kind=${kind}&page=0&limit=50`, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });
  const payload = (await response.json()) as { registry?: AleoPublicIndexPage };
  if (!response.ok || !payload.registry || payload.registry.kind !== kind) {
    throw new Error("Aleo Testnet Registry unavailable");
  }
  return payload.registry;
}

function shortField(value: string) {
  return value.length <= 24 ? value : `${value.slice(0, 12)}...${value.slice(-8)}`;
}

function severityLabel(value: string, text: (chinese: string, english: string) => string) {
  const labels: Record<string, readonly [string, string]> = {
    Critical: ["严重", "Critical"],
    High: ["高危", "High"],
    Medium: ["中危", "Medium"],
    Low: ["低危", "Low"],
  };
  return labels[value] ? text(...labels[value]) : value;
}

export function AleoRegistryOverview() {
  const { text } = useLocale();
  const [registry, setRegistry] = useState<RegistryState>({ kind: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchRegistry("bounties", controller.signal), fetchRegistry("claims", controller.signal)])
      .then(([bounties, claims]) => {
        if (bounties.kind !== "bounties" || claims.kind !== "claims") {
          throw new Error("Aleo Registry kind mismatch");
        }
        setRegistry({ kind: "loaded", bounties, claims });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRegistry({ kind: "unavailable" });
      });
    return () => controller.abort();
  }, [refreshKey]);

  if (registry.kind === "loading") {
    return <section className="surface-card h-full rounded-lg p-5" aria-live="polite"><div className="flex min-h-28 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle className="animate-spin text-cyan-200" size={18} aria-hidden="true" />{text("正在读取 Aleo 测试网链上注册表", "Reading the Aleo Testnet Registry")}</div></section>;
  }

  if (registry.kind === "unavailable") {
    return (
      <section className="surface-card h-full rounded-lg p-5" aria-live="polite">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <ExecutionStatusBadge kind="unavailable" label={text("注册表暂不可用", "Registry unavailable")} />
            <h2 className="mt-3 text-xl font-semibold text-white">{text("链上注册表暂时无法读取", "The on-chain Registry is temporarily unavailable")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{text("页面不会使用模拟数据或本地存储补齐指标，也不会显示假成功。", "The page does not fill metrics from Mock data or localStorage, and it never shows a false success.")}</p>
          </div>
          <button className="focus-ring secondary-action shrink-0" onClick={() => { setRegistry({ kind: "loading" }); setRefreshKey((value) => value + 1); }} type="button"><RefreshCw size={16} aria-hidden="true" />{text("重新查询", "Query again")}</button>
        </div>
      </section>
    );
  }

  const verifiedBounties = registry.bounties.items.filter((item) => item.mappingStatus === "Verified");
  const verifiedClaims = registry.claims.items.filter((item) => item.mappingStatus === "Verified" && item.receipt);
  const recentClaims = verifiedClaims.slice(0, 3);

  return (
    <section className="surface-card h-full rounded-lg p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="page-kicker">{text("链上注册表", "On-chain Registry")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{text("Aleo 测试网协议总览", "Aleo Testnet protocol overview")}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{text("数据来自公开交易索引，并以程序映射结果作为最终权威。", "Data comes from public transaction discovery, with Program Mapping results as the final authority.")}</p>
        </div>
        <ExecutionStatusBadge kind="onchain" label={text("测试网映射读取", "Testnet Mapping read")} />
      </div>

      <div className="grid border-b border-white/10 py-5 sm:grid-cols-3">
        <RegistryMetric label={text("已验证赏金", "Verified Bounties")} value={`${verifiedBounties.length}${registry.bounties.hasMore ? "+" : ""}`} />
        <RegistryMetric label={text("已验证漏洞声明", "Verified Claims")} value={`${verifiedClaims.length}${registry.claims.hasMore ? "+" : ""}`} />
        <RegistryMetric label={text("数据权威", "Data authority")} value={text("Aleo 映射", "Aleo Mappings")} />
      </div>

      <div className="pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">{text("最近公开漏洞声明", "Recent public Claims")}</h3>
          <Link className="text-xs font-semibold text-cyan-200 hover:text-cyan-100" href="/public-claims">{text("查看完整注册表", "View full Registry")}</Link>
        </div>
        {recentClaims.length ? <div className="mt-3 divide-y divide-white/10">{recentClaims.map((claim) => <div className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center" key={claim.claimHash}><div className="min-w-0"><p className="truncate font-mono text-cyan-50" title={claim.claimHash}>{shortField(claim.claimHash)}</p><p className="mt-1 truncate text-xs text-slate-500" title={claim.bountyId}>{text("赏金", "Bounty")} {shortField(claim.bountyId)}</p></div><span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-emerald-100"><CheckCircle2 size={14} aria-hidden="true" />{severityLabel(claim.receipt?.severity ?? "", text)} · {text("已验证", "Verified")}</span><a aria-label={text("在 Provable 区块浏览器查看交易", "View transaction in Provable Explorer")} className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white" href={`https://testnet.explorer.provable.com/transaction/${claim.transactionId}`} rel="noreferrer" target="_blank" title={text("查看交易", "View transaction")}><ExternalLink size={15} aria-hidden="true" /></a></div>)}</div> : <p className="mt-3 flex items-center gap-2 py-4 text-sm text-slate-500"><Database size={16} aria-hidden="true" />{text("当前查询页没有映射已验证的漏洞声明。", "This query page has no Mapping Verified Claim.")}</p>}
      </div>
    </section>
  );
}

function RegistryMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-white/10 py-2 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-white">{value}</p></div>;
}