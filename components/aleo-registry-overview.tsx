"use client";

import { CheckCircle2, Database, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { AleoPublicIndexPage } from "@/lib/aleo-public-index";
import { ExecutionStatusBadge } from "./execution-status-badge";

type BountyPage = Extract<AleoPublicIndexPage, { kind: "bounties" }>;
type ClaimPage = Extract<AleoPublicIndexPage, { kind: "claims" }>;

type RegistryState =
  | { kind: "loading" }
  | { kind: "loaded"; bounties: BountyPage; claims: ClaimPage }
  | { kind: "unavailable" };

async function fetchRegistry(
  kind: "bounties" | "claims",
  signal: AbortSignal,
): Promise<AleoPublicIndexPage> {
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

export function AleoRegistryOverview() {
  const [registry, setRegistry] = useState<RegistryState>({ kind: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchRegistry("bounties", controller.signal),
      fetchRegistry("claims", controller.signal),
    ])
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
    return (
      <section className="surface-card rounded-lg p-5" aria-live="polite">
        <div className="flex min-h-28 items-center justify-center gap-3 text-sm text-slate-400">
          <LoaderCircle className="animate-spin text-cyan-200" size={18} aria-hidden="true" />
          正在读取 Aleo Testnet Registry
        </div>
      </section>
    );
  }

  if (registry.kind === "unavailable") {
    return (
      <section className="surface-card rounded-lg p-5" aria-live="polite">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <ExecutionStatusBadge kind="unavailable" label="Registry unavailable" />
            <h2 className="mt-3 text-xl font-semibold text-white">链上 Registry 暂时无法读取</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              页面不会使用 Mock 或 localStorage 补齐指标，也不会显示假成功。
            </p>
          </div>
          <button
            className="focus-ring secondary-action shrink-0"
            onClick={() => {
              setRegistry({ kind: "loading" });
              setRefreshKey((value) => value + 1);
            }}
            type="button"
          >
            <RefreshCw size={16} aria-hidden="true" />
            重新查询
          </button>
        </div>
      </section>
    );
  }

  const verifiedBounties = registry.bounties.items.filter(
    (item) => item.mappingStatus === "Verified",
  );
  const verifiedClaims = registry.claims.items.filter(
    (item) => item.mappingStatus === "Verified" && item.receipt,
  );
  const recentClaims = verifiedClaims.slice(0, 3);

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="page-kicker">链上 Registry</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Aleo Testnet 协议总览</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            数据来自公开 Transaction discovery，并以 Program Mapping 结果作为最终权威。
          </p>
        </div>
        <ExecutionStatusBadge kind="onchain" label="Testnet Mapping read" />
      </div>

      <div className="grid border-b border-white/10 py-5 sm:grid-cols-3">
        <RegistryMetric
          label="已验证 Bounties"
          value={`${verifiedBounties.length}${registry.bounties.hasMore ? "+" : ""}`}
        />
        <RegistryMetric
          label="已验证 Claims"
          value={`${verifiedClaims.length}${registry.claims.hasMore ? "+" : ""}`}
        />
        <RegistryMetric label="数据权威" value="Aleo Mappings" />
      </div>

      <div className="pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">最近公开 Claim</h3>
          <Link className="text-xs font-semibold text-cyan-200 hover:text-cyan-100" href="/public-claims">
            查看完整 Registry
          </Link>
        </div>
        {recentClaims.length ? (
          <div className="mt-3 divide-y divide-white/10">
            {recentClaims.map((claim) => (
              <div
                className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"
                key={claim.claimHash}
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-cyan-50" title={claim.claimHash}>
                    {shortField(claim.claimHash)}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500" title={claim.bountyId}>
                    Bounty {shortField(claim.bountyId)}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-emerald-100">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {claim.receipt?.severity} · Verified
                </span>
                <a
                  aria-label="在 Provable Explorer 查看交易"
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-white"
                  href={`https://testnet.explorer.provable.com/transaction/${claim.transactionId}`}
                  rel="noreferrer"
                  target="_blank"
                  title="查看交易"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 py-4 text-sm text-slate-500">
            <Database size={16} aria-hidden="true" />
            当前查询页没有 Mapping Verified Claim。
          </p>
        )}
      </div>
    </section>
  );
}

function RegistryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-white/10 py-2 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
