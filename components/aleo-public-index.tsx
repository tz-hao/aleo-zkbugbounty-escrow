"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { getOnChainBountyOperationalStatus } from "@/lib/aleo-bounty-registry";
import type { AleoPublicIndexPage, IndexedBounty, MappingVerificationStatus } from "@/lib/aleo-public-index";
import { useLocale } from "./locale-provider";

type IndexKind = "bounties" | "claims";
type BountyFilter = "all" | "active" | "inactive";
type Localize = (chinese: string, english: string) => string;

const ruleLabels: Record<string, { chinese: string; english: string }> = {
  "vault-accounting-safety": { chinese: "金库记账安全", english: "Vault Accounting Safety" },
  "claims-vs-deposits": { chinese: "索赔与存款安全", english: "Claims vs Deposits Safety" },
  "reward-reserve-safety": { chinese: "奖励准备金安全", english: "Reward Reserve Safety" },
  "withdraw-limit-safety": { chinese: "提款限额安全", english: "Withdrawal Limit Safety" },
};

const bountyStatusLabels: Record<string, { chinese: string; english: string }> = {
  Active: { chinese: "进行中", english: "Active" },
  Paused: { chinese: "已暂停", english: "Paused" },
  Closed: { chinese: "已关闭", english: "Closed" },
  Expired: { chinese: "已过期", english: "Expired" },
};

const severityLabels: Record<string, { chinese: string; english: string }> = {
  Critical: { chinese: "严重", english: "Critical" },
  High: { chinese: "高危", english: "High" },
  Medium: { chinese: "中危", english: "Medium" },
  Low: { chinese: "低危", english: "Low" },
};

function labelFor(
  labels: Record<string, { chinese: string; english: string }>,
  value: string,
  text: Localize,
) {
  const label = labels[value];
  return label ? text(label.chinese, label.english) : value;
}

function finalizedLabel(finalizedAt: number | null, text: Localize) {
  if (finalizedAt === null) return text("确认时间未返回", "Finalization time unavailable");
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(finalizedAt * 1_000));
}

export function AleoPublicIndex() {
  const { text } = useLocale();
  const [kind, setKind] = useState<IndexKind>("bounties");
  const [bountyFilter, setBountyFilter] = useState<BountyFilter>("all");
  const [page, setPage] = useState(0);
  const [registry, setRegistry] = useState<AleoPublicIndexPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/aleo/registry?kind=${kind}&page=${page}&limit=10`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch("/api/aleo/network", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([response, networkResponse]) => {
        const payload = await response.json();
        if (!response.ok || !payload.registry) {
          throw new Error("Aleo Testnet public index unavailable");
        }
        const networkPayload = networkResponse.ok
          ? await networkResponse.json() as { network?: { latestHeight?: number } }
          : null;
        if (active) {
          setRegistry(payload.registry as AleoPublicIndexPage);
          const latestHeight = networkPayload?.network?.latestHeight;
          setCurrentHeight(Number.isSafeInteger(latestHeight) ? latestHeight! : null);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active && !(caught instanceof DOMException && caught.name === "AbortError")) {
          setRegistry(null);
          setError(text("Aleo 测试网索引暂时不可用。未使用模拟数据或本地存储回退。", "Aleo Testnet index is temporarily unavailable. No Mock or localStorage fallback is used."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [kind, page, requestVersion, text]);

  function changeKind(nextKind: IndexKind) {
    setKind(nextKind);
    setPage(0);
    setRegistry(null);
    setError("");
    setLoading(true);
  }

  function operationalStatus(item: IndexedBounty) {
    if (!item.bounty) return null;
    return currentHeight === null
      ? item.bounty.status
      : getOnChainBountyOperationalStatus(item.bounty, currentHeight);
  }

  function retry() {
    setRegistry(null);
    setError("");
    setLoading(true);
    setRequestVersion((value) => value + 1);
  }

  const items = registry?.kind === kind ? registry.items : [];
  const visibleBounties = registry?.kind === "bounties"
    ? registry.items.filter((item) => {
      if (bountyFilter === "all") return true;
      const status = operationalStatus(item);
      return bountyFilter === "active" ? status === "Active" : status !== null && status !== "Active";
    })
    : [];
  const visibleItems = registry?.kind === "bounties" ? visibleBounties : items;
  const emptyMessage = kind === "bounties"
    ? bountyFilter === "active"
      ? text("当前页没有可参与的进行中赏金；可切换到“全部”查看历史记录。", "This page has no active Bounties; switch to All to view historical records.")
      : text("当前页没有发现创建赏金交易。", "This page has no discovered create-bounty transactions.")
    : text("当前页没有发现提交声明交易。", "This page has no discovered claim-submission transactions.");

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="page-kicker">{text("链上注册表", "On-chain Registry")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{text("公开链上索引", "Public on-chain index")}</h2>
        </div>
        <div className="inline-flex w-fit rounded-md border border-white/10 bg-black/20 p-1" aria-label={text("注册表视图", "Registry view")}>
          {(["bounties", "claims"] as const).map((item) => (
            <button
              className={`focus-ring min-h-11 rounded px-3 py-2 text-xs font-semibold ${
                kind === item ? "bg-cyan-300/15 text-cyan-100" : "text-slate-400 hover:text-white"
              }`}
              key={item}
              type="button"
              onClick={() => changeKind(item)}
            >
              {item === "bounties" ? text("赏金", "Bounties") : text("漏洞声明", "Claims")}
            </button>
          ))}
        </div>
      </div>

      {kind === "bounties" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={text("赏金状态筛选", "Bounty status filter")}>
          <span className="text-xs text-slate-500">{text("显示", "Show")}</span>
          {([
            ["all", text("全部", "All")],
            ["active", text("仅进行中", "Active only")],
            ["inactive", text("暂停、关闭与过期", "Paused, closed, and expired")],
          ] as const).map(([filter, label]) => (
            <button
              className={`focus-ring min-h-9 rounded-md border px-3 text-xs font-semibold ${
                bountyFilter === filter
                  ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.025] text-slate-400 hover:text-white"
              }`}
              key={filter}
              onClick={() => setBountyFilter(filter)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 border-y border-white/10">
        {loading ? (
          <p className="py-8 text-sm text-slate-400">{text("正在读取 Aleo 测试网公开索引与映射数据…", "Reading the Aleo Testnet public index and mappings...")}</p>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-sm text-amber-100">{error}</p>
            <button className="focus-ring secondary-action" type="button" onClick={retry}>
              <RefreshCw size={15} aria-hidden="true" />
              {text("重试", "Retry")}
            </button>
          </div>
        ) : visibleItems.length === 0 ? (
          <p className="py-8 text-sm text-slate-400">{emptyMessage}</p>
        ) : registry?.kind === "bounties" ? (
          visibleBounties.map((item) => (
            <article className="grid gap-4 border-b border-white/10 py-5 last:border-b-0 lg:grid-cols-[1fr_auto]" key={item.transactionId}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <IndexStatus status={item.mappingStatus} />
                  <span className="text-xs text-slate-500">{text("交易已确认", "Transaction accepted")}</span>
                  <span className="text-xs text-slate-500">{text("协议", "Protocol")} V{item.protocolVersion}</span>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-cyan-100">{item.bountyId}</p>
                <p className="mt-2 text-xs text-slate-500">{text("确认时间", "Finalized")} {finalizedLabel(item.finalizedAt, text)}</p>
                {item.bounty ? (
                  <p className="mt-2 text-sm text-slate-400">
                    {labelFor(ruleLabels, item.bounty.ruleId, text)} · {labelFor(
                      bountyStatusLabels,
                      currentHeight === null
                        ? item.bounty.status
                        : getOnChainBountyOperationalStatus(item.bounty, currentHeight),
                      text,
                    )} · {text("所有者", "Owner")} {shorten(item.bounty.owner)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-100">
                    {item.mappingStatus === "Unavailable"
                      ? text("暂时无法读取映射；该条目不会作为有效赏金展示。", "The mapping cannot be read temporarily, so this item is not shown as a valid bounty.")
                      : text("映射未验证，不能作为有效赏金展示。", "Mapping is unverified and cannot be shown as a valid bounty.")}
                  </p>
                )}
              </div>
              <ExplorerLink transactionId={item.transactionId} />
            </article>
          ))
        ) : registry?.kind === "claims" ? (
          registry.items.map((item) => (
            <article className="grid gap-4 border-b border-white/10 py-5 last:border-b-0 lg:grid-cols-[1fr_auto]" key={item.transactionId}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <IndexStatus status={item.mappingStatus} />
                  <span className="text-xs text-slate-500">{text("交易已确认", "Transaction accepted")}</span>
                  <span className="text-xs text-slate-500">{text("协议", "Protocol")} V{item.protocolVersion}</span>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-cyan-100">{item.claimHash}</p>
                <p className="mt-2 text-xs text-slate-500">{text("确认时间", "Finalized")} {finalizedLabel(item.finalizedAt, text)}</p>
                {item.receipt ? (
                  <p className="mt-2 text-sm text-slate-400">
                    {labelFor(ruleLabels, item.receipt.ruleId, text)} · {labelFor(severityLabels, item.receipt.severity, text)} · {text("区块", "Block")} {item.receipt.createdHeight}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-100">
                    {item.mappingStatus === "Unavailable"
                      ? text("暂时无法读取收据或防重复标识映射；该条目不会作为有效漏洞声明展示。", "The receipt or nullifier mapping cannot be read temporarily, so this item is not shown as a valid claim.")
                      : text("收据或防重复标识映射未验证。", "Receipt or nullifier mapping is unverified.")}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap content-start gap-2">
                <Link className="focus-ring secondary-action w-fit" href={`/public-claims/${encodeURIComponent(item.claimHash)}`}>
                  {text("公开收据", "Public receipt")}
                </Link>
                <ExplorerLink transactionId={item.transactionId} />
              </div>
            </article>
          ))        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          className="focus-ring secondary-action"
          disabled={page === 0 || loading}
          type="button"
          onClick={() => {
            setLoading(true);
            setPage((value) => Math.max(0, value - 1));
          }}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          {text("上一页", "Previous")}
        </button>
        <span className="text-xs text-slate-500">{text(`第 ${page + 1} 页`, `Page ${page + 1}`)}</span>
        <button
          className="focus-ring secondary-action"
          disabled={!registry?.hasMore || loading}
          type="button"
          onClick={() => {
            setLoading(true);
            setPage((value) => value + 1);
          }}
        >
          {text("下一页", "Next")}
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function IndexStatus({ status }: { status: MappingVerificationStatus }) {
  const { text } = useLocale();
  const labels: Record<MappingVerificationStatus, { chinese: string; english: string }> = {
    Verified: { chinese: "映射已验证", english: "Mapping verified" },
    Missing: { chinese: "未找到映射", english: "Mapping missing" },
    Mismatch: { chinese: "映射不匹配", english: "Mapping mismatch" },
    Unavailable: { chinese: "映射暂不可用", english: "Mapping unavailable" },
  };
  const tone = status === "Verified"
    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
    : status === "Unavailable"
      ? "border-amber-300/25 bg-amber-300/10 text-amber-100"
      : "border-red-300/25 bg-red-300/10 text-red-100";
  const label = labels[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${tone}`}>
      <ShieldCheck size={13} aria-hidden="true" />
      {text(label.chinese, label.english)}
    </span>
  );
}

function ExplorerLink({ transactionId }: { transactionId: string }) {
  const { text } = useLocale();
  return (
    <a
      className="focus-ring secondary-action w-fit"
      href={`https://testnet.explorer.provable.com/transaction/${transactionId}`}
      rel="noreferrer"
      target="_blank"
    >
      {text("区块浏览器", "Explorer")}
      <ExternalLink size={15} aria-hidden="true" />
    </a>
  );
}

function shorten(value: string) {
  return value.length > 22 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}
