"use client";

import { useState } from "react";
import { DatabaseZap, RefreshCw, ShieldCheck } from "lucide-react";

import type { OnChainNullifierState, ProofVerification } from "@/lib/models";

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; value: OnChainNullifierState }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export function AleoNullifierStatus({
  nullifier,
  verification,
}: {
  nullifier: string;
  verification?: ProofVerification;
}) {
  const [lookupState, setLookup] = useState<{
    forNullifier: string;
    result: LookupState;
  }>({ forNullifier: "", result: { kind: "idle" } });
  const state: LookupState = lookupState.forNullifier === nullifier
    ? lookupState.result
    : { kind: "idle" };

  async function lookup() {
    setLookup({ forNullifier: nullifier, result: { kind: "loading" } });
    try {
      const response = await fetch(`/api/aleo/nullifiers/${encodeURIComponent(nullifier)}`, {
        method: "GET",
        cache: "no-store",
      });
      if (response.status === 404) {
        setLookup({ forNullifier: nullifier, result: { kind: "not-found" } });
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isLookupResponse(payload)) {
        const message = readError(payload) ?? "暂时无法读取 Aleo Testnet Nullifier Registry";
        setLookup({ forNullifier: nullifier, result: { kind: "error", message } });
        return;
      }
      setLookup({ forNullifier: nullifier, result: { kind: "found", value: payload.nullifier } });
    } catch {
      setLookup({
        forNullifier: nullifier,
        result: { kind: "error", message: "暂时无法连接 Aleo Testnet Registry" },
      });
    }
  }

  if (!nullifier) return null;

  const networkConfirmed = verification?.level === "NetworkConfirmed";

  return (
    <section className="mt-4 rounded-lg border border-violet-300/20 bg-violet-300/[0.05] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-100">
            <DatabaseZap size={16} aria-hidden="true" />
            链上 Nullifier Registry
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
            本地检查仅用于 Demo UX。防重放安全性由 Aleo Program 的
            <span className="mx-1 font-mono text-slate-300">nullifiers</span>
            mapping 在 <span className="font-mono text-slate-300">submit_claim</span> Final 中执行。
          </p>
        </div>
        <button
          className="focus-ring secondary-action min-h-9 px-3 py-2 text-xs"
          disabled={state.kind === "loading"}
          onClick={lookup}
          type="button"
        >
          <RefreshCw className={state.kind === "loading" ? "animate-spin" : ""} size={14} aria-hidden="true" />
          查询 Testnet
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2 text-xs leading-5">
        <ShieldCheck
          className={networkConfirmed ? "mt-0.5 text-emerald-300" : "mt-0.5 text-amber-300"}
          size={15}
          aria-hidden="true"
        />
        <p className={networkConfirmed ? "text-emerald-100" : "text-amber-100"}>
          {networkConfirmed
            ? "该结果标记为 Network Confirmed，仍可通过公开 mapping 独立复核。"
            : "当前 Proof 尚非 Network Confirmed；生成本地结果不会自动占用链上 Nullifier。"}
        </p>
      </div>

      {state.kind === "found" ? (
        <p className="mt-3 break-all rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-xs text-emerald-100">
          已占用，关联 Bounty：<span className="font-mono">{state.value.bountyId}</span>
        </p>
      ) : null}
      {state.kind === "not-found" ? (
        <p className="mt-3 rounded-md border border-slate-300/15 bg-white/[0.03] p-3 text-xs text-slate-300">
          当前配置的 Testnet mapping 中未找到该 Nullifier。
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-100">
          {state.message}。不会回退到 localStorage 或 Demo State。
        </p>
      ) : null}
    </section>
  );
}

function isLookupResponse(value: unknown): value is { nullifier: OnChainNullifierState } {
  if (typeof value !== "object" || value === null || !("nullifier" in value)) return false;
  const state = value.nullifier;
  return (
    typeof state === "object" &&
    state !== null &&
    "used" in state &&
    state.used === true &&
    "bountyId" in state &&
    typeof state.bountyId === "string"
  );
}

function readError(value: unknown) {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  return typeof value.error === "string" ? value.error : null;
}
