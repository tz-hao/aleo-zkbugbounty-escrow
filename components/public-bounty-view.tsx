"use client";

import { ArrowUpRight, CircleAlert, Database, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getOnChainBountyOperationalStatus } from "@/lib/aleo-bounty-registry";
import type { OnChainBountyState } from "@/lib/models";

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
          <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">Aleo Testnet query</span>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300">Data Source: Aleo Testnet Public Mapping</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">公开 Bounty Registry</h1>
        <p className="mt-3 break-all font-mono text-sm text-cyan-100">{bountyId}</p>
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6" aria-live="polite">
        {state.kind === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-slate-300"><LoaderCircle className="animate-spin text-cyan-200" size={16} aria-hidden="true" />正在读取 Testnet mapping...</p>
        ) : state.kind === "found" ? (
          <BountyFacts bounty={state.bounty} currentHeight={state.currentHeight} />
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="flex items-start gap-2 text-sm leading-6 text-amber-100"><CircleAlert className="mt-1 shrink-0" size={16} aria-hidden="true" />{state.message}</p>
            <button className="focus-ring secondary-action" type="button" onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" />重新查询</button>
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
  const operationalStatus = currentHeight === null
    ? bounty.status
    : getOnChainBountyOperationalStatus(bounty, currentHeight);
  const acceptsClaims = operationalStatus === "Active";
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-100"><ShieldCheck size={16} aria-hidden="true" />Mapping found</p>
          <h2 className="mt-2 text-xl font-semibold text-white">链上 Bounty 状态</h2>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs text-cyan-100"><Database size={14} aria-hidden="true" />{bounty.mapping}</span>
      </div>
      <dl className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        <PublicFact label="Owner" value={bounty.owner} />
        <PublicFact label="On-chain Status" value={bounty.status} />
        <PublicFact label="Operational Status" value={operationalStatus} />
        <PublicFact label="Rule ID" value={bounty.ruleId} />
        <PublicFact label="Scope Hash" value={bounty.scopeHash} />
        <PublicFact label="Critical Reward" value={`${bounty.rewards.critical} microcredits`} />
        <PublicFact label="High Reward" value={`${bounty.rewards.high} microcredits`} />
        <PublicFact label="Medium Reward" value={`${bounty.rewards.medium} microcredits`} />
        <PublicFact label="Low Reward" value="Not claimable (0-9 impact)" />
        <PublicFact label="Disclosure Deadline" value={String(bounty.disclosureDeadline)} />
        <PublicFact label="Current Height" value={currentHeight === null ? "Unavailable" : String(currentHeight)} />
        <PublicFact label="Program" value={bounty.programId} />
        <PublicFact label="Network" value={bounty.network} />
        <PublicFact label="Data Source" value={bounty.source} />
      </dl>
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap gap-3">
          <Link className="focus-ring secondary-action w-fit" href="/public-claims">打开 Public Registry Console<ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Link
            aria-disabled={!acceptsClaims}
            className={`focus-ring primary-action w-fit ${acceptsClaims ? "" : "pointer-events-none opacity-40"}`}
            href={`/submit-proof?bountyId=${encodeURIComponent(bounty.bountyId)}`}
          >
            {acceptsClaims ? "提交 Wallet-signed Claim" : "Bounty 不再接受 Claim"}
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
