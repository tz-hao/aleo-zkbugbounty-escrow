"use client";

import { useState } from "react";
import { DatabaseZap, RefreshCw, ShieldCheck } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
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
  const { text } = useLocale();
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
        const message = readError(payload) ?? text(
          "暂时无法读取 Aleo Testnet Nullifier Registry",
          "The Aleo Testnet Nullifier Registry is temporarily unavailable.",
        );
        setLookup({ forNullifier: nullifier, result: { kind: "error", message } });
        return;
      }
      setLookup({ forNullifier: nullifier, result: { kind: "found", value: payload.nullifier } });
    } catch {
      setLookup({
        forNullifier: nullifier,
        result: {
          kind: "error",
          message: text(
            "暂时无法连接 Aleo Testnet Registry",
            "Unable to reach the Aleo Testnet Registry right now.",
          ),
        },
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
            {text("链上防重复标识注册表", "On-chain Nullifier Registry")}
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
            {text("本地检查仅用于界面提示。防重放安全性由 Aleo 程序的", "The local check is Demo UX only. Replay protection is enforced by the Aleo Program's")}
            <span className="mx-1 font-mono text-slate-300">nullifiers</span>
            {text("映射在", "mapping in")}
            <span className="mx-1 font-mono text-slate-300">submit_claim</span>
            Final {text("中执行。", ".")}
          </p>
        </div>
        <button
          className="focus-ring secondary-action min-h-9 px-3 py-2 text-xs"
          disabled={state.kind === "loading"}
          onClick={lookup}
          type="button"
        >
          <RefreshCw className={state.kind === "loading" ? "animate-spin" : ""} size={14} aria-hidden="true" />
          {text("查询测试网", "Query Testnet")}
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
            ? text(
              "该结果已达到网络确认级别，仍可通过公开映射独立复核。",
              "This result is Network Confirmed and can still be independently checked against the public mapping.",
            )
            : text(
              "当前证明尚未达到网络确认级别；生成本地结果不会自动占用链上防重复标识。",
              "This Proof is not Network Confirmed. A local result does not reserve an on-chain Nullifier.",
            )}
        </p>
      </div>

      {state.kind === "found" ? (
        <p className="mt-3 break-all rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-xs text-emerald-100">
          {text("已占用，关联赏金：", "Already used by Bounty: ")}<span className="font-mono">{state.value.bountyId}</span>
        </p>
      ) : null}
      {state.kind === "not-found" ? (
        <p className="mt-3 rounded-md border border-slate-300/15 bg-white/[0.03] p-3 text-xs text-slate-300">
          {text("当前配置的测试网映射中未找到该防重复标识。", "This Nullifier is not present in the configured Testnet mapping.")}
        </p>
      ) : null}
      {state.kind === "error" ? (
        <p className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-100">
          {state.message} {text("不会回退到浏览器本地存储或演示状态。", "There is no localStorage or Demo State fallback.")}
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
