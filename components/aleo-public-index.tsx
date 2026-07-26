"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

import type { AleoPublicIndexPage } from "@/lib/aleo-public-index";

type IndexKind = "bounties" | "claims";

export function AleoPublicIndex() {
  const [kind, setKind] = useState<IndexKind>("bounties");
  const [page, setPage] = useState(0);
  const [registry, setRegistry] = useState<AleoPublicIndexPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetch(`/api/aleo/registry?kind=${kind}&page=${page}&limit=10`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.registry) {
          throw new Error("Aleo Testnet public index unavailable");
        }
        if (active) {
          setRegistry(payload.registry as AleoPublicIndexPage);
          setError("");
        }
      })
      .catch((caught: unknown) => {
        if (active && !(caught instanceof DOMException && caught.name === "AbortError")) {
          setRegistry(null);
          setError("Aleo Testnet 索引暂时不可用。没有使用 Mock 或 localStorage fallback。");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [kind, page, requestVersion]);

  function changeKind(nextKind: IndexKind) {
    setKind(nextKind);
    setPage(0);
    setRegistry(null);
    setError("");
    setLoading(true);
  }

  function retry() {
    setRegistry(null);
    setError("");
    setLoading(true);
    setRequestVersion((value) => value + 1);
  }

  const items = registry?.kind === kind ? registry.items : [];

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="page-kicker">链上 Registry</p>
          <h2 className="mt-2 text-xl font-semibold text-white">公开链上索引</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            RPC 只负责发现公开 Transaction；每条结果必须再次通过 Aleo Mapping 验证。Confirmed 不等于 Mapping Verified。
          </p>
        </div>
        <div className="inline-flex w-fit rounded-md border border-white/10 bg-black/20 p-1" aria-label="Registry view">
          {(["bounties", "claims"] as const).map((item) => (
            <button
              className={`focus-ring min-h-11 rounded px-3 py-2 text-xs font-semibold ${
                kind === item ? "bg-cyan-300/15 text-cyan-100" : "text-slate-400 hover:text-white"
              }`}
              key={item}
              type="button"
              onClick={() => changeKind(item)}
            >
              {item === "bounties" ? "Bounties" : "Claims"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 border-y border-white/10">
        {loading ? (
          <p className="py-8 text-sm text-slate-400">正在读取 Aleo Testnet RPC 与 Mapping...</p>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-sm text-amber-100">{error}</p>
            <button className="focus-ring secondary-action" type="button" onClick={retry}>
              <RefreshCw size={15} aria-hidden="true" />
              重试
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-sm text-slate-400">
            当前分页没有已发现的 {kind === "bounties" ? "create_bounty" : "submit_claim"} Transaction。
          </p>
        ) : registry?.kind === "bounties" ? (
          registry.items.map((item) => (
            <article className="grid gap-4 border-b border-white/10 py-5 last:border-b-0 lg:grid-cols-[1fr_auto]" key={item.transactionId}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <IndexStatus status={item.mappingStatus} />
                  <span className="text-xs text-slate-500">Transaction Accepted</span>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-cyan-100">{item.bountyId}</p>
                {item.bounty ? (
                  <p className="mt-2 text-sm text-slate-400">
                    {item.bounty.ruleId} · {item.bounty.status} · Owner {shorten(item.bounty.owner)}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-red-200">Mapping 未验证，不能作为有效 Bounty 展示。</p>
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
                  <span className="text-xs text-slate-500">Transaction Accepted</span>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-cyan-100">{item.claimHash}</p>
                {item.receipt ? (
                  <p className="mt-2 text-sm text-slate-400">
                    {item.receipt.ruleId} · {item.receipt.severity} · Block {item.receipt.createdHeight}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-red-200">Receipt 或 Nullifier Mapping 未验证。</p>
                )}
              </div>
              <ExplorerLink transactionId={item.transactionId} />
            </article>
          ))
        ) : null}
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
          上一页
        </button>
        <span className="text-xs text-slate-500">Page {page + 1}</span>
        <button
          className="focus-ring secondary-action"
          disabled={!registry?.hasMore || loading}
          type="button"
          onClick={() => {
            setLoading(true);
            setPage((value) => value + 1);
          }}
        >
          下一页
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function IndexStatus({ status }: { status: "Verified" | "Missing" | "Mismatch" }) {
  const verified = status === "Verified";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
      verified
        ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
        : "border-red-300/25 bg-red-300/10 text-red-100"
    }`}>
      <ShieldCheck size={13} aria-hidden="true" />
      Mapping {status}
    </span>
  );
}

function ExplorerLink({ transactionId }: { transactionId: string }) {
  return (
    <a
      className="focus-ring secondary-action w-fit"
      href={`https://testnet.explorer.provable.com/transaction/${transactionId}`}
      rel="noreferrer"
      target="_blank"
    >
      Explorer
      <ExternalLink size={15} aria-hidden="true" />
    </a>
  );
}

function shorten(value: string) {
  return value.length > 22 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}
