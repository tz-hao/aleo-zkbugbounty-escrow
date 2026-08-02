"use client";

import { CircleDollarSign, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";

import {
  RESPONSIBLE_DISCLOSURE_FUNCTIONS,
  REWARD_ESCROW_CAPABILITY,
  REWARD_ESCROW_FUNCTIONS,
  type RewardEscrowCapability,
} from "@/lib/aleo-reward-escrow";

export function RewardEscrowStatus() {
  const [capability, setCapability] = useState<RewardEscrowCapability>(
    REWARD_ESCROW_CAPABILITY,
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/aleo/escrow", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { escrow?: RewardEscrowCapability };
        if (payload.escrow) setCapability(payload.escrow);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCapability({ ...REWARD_ESCROW_CAPABILITY, status: "EndpointUnavailable" });
        }
      });
    return () => controller.abort();
  }, []);

  const available = capability.status === "Available";
  const title = available
    ? "On-chain Escrow Available"
    : capability.status === "ProgramUpgradeRequired"
      ? "Program Upgrade Required"
      : capability.status === "EndpointUnavailable"
        ? "Capability Check Unavailable"
        : "Escrow Configuration Error";
  const description = available
    ? "已检测到 Credits Escrow 与 Responsible Disclosure mappings。Paid 仍必须以 Confirmed Transaction 和 Mapping Verified 为准。"
    : capability.status === "ProgramUpgradeRequired"
      ? "Escrow 代码、ABI 与 Wallet Preview 已准备；当前 Testnet edition 尚未广播升级，因此 RewardLocked / Paid 仍不可用。"
      : "公开 Program endpoint 暂时无法完成能力核验。系统不会把节点错误解释为 Escrow 未部署，也不会回退到 Demo 状态。";

  return (
    <section className="surface-card rounded-lg p-5" aria-labelledby="reward-escrow-status-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300">
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="page-kicker">链上支付能力</p>
            <h2 id="reward-escrow-status-title" className="mt-2 text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {description}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
            available
              ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100"
              : "border-amber-300/20 bg-amber-300/[0.07] text-amber-100"
          }`}
        >
          <CircleDollarSign size={14} aria-hidden="true" />
          {available ? "链上能力已验证" : "链上支付尚未激活"}
        </span>
      </div>
      <details className="group mt-4 border-t border-white/10 pt-3">
        <summary className="focus-ring min-h-11 cursor-pointer list-none py-2 text-xs font-semibold text-slate-400 hover:text-white [&::-webkit-details-marker]:hidden">
          {available ? "查看已启用的 Program 入口" : "查看待启用的 Program 入口"}
        </summary>
        <div className="grid gap-3 pt-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          {[...REWARD_ESCROW_FUNCTIONS, ...RESPONSIBLE_DISCLOSURE_FUNCTIONS].map((functionName) => (
            <div className="min-w-0" key={functionName}>
              <p className="text-slate-500">Program entry</p>
              <p className="mt-1 break-all font-mono text-slate-300">{functionName}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">
          <p>
            Paid 必须同时满足 Confirmed Transaction 与 Mapping Verified；当前不会回退到 Mock 或
            localStorage。Capability: {capability.status}.
          </p>
          <p>
            On-chain Triage: {capability.status}. Real Mode 权限来自
            <span className="mx-1 font-mono text-slate-300">std::ctx::signer()</span>与 Program Mapping；
            Demo Preview 不具备链上授权能力。
          </p>
        </div>
      </details>
    </section>
  );
}
