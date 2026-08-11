"use client";

import { CircleDollarSign, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";

import {
  RESPONSIBLE_DISCLOSURE_FUNCTIONS,
  REWARD_ESCROW_CAPABILITY,
  REWARD_ESCROW_FUNCTIONS,
  type RewardEscrowCapability,
} from "@/lib/aleo-reward-escrow";
import { useLocale } from "./locale-provider";

export function RewardEscrowStatus() {
  const { text } = useLocale();
  const [capability, setCapability] = useState<RewardEscrowCapability>(
    REWARD_ESCROW_CAPABILITY,
  );
  const [capabilityChecked, setCapabilityChecked] = useState(false);

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
      })
      .finally(() => {
        if (!controller.signal.aborted) setCapabilityChecked(true);
      });
    return () => controller.abort();
  }, []);

  const available = capabilityChecked && capability.status === "Available";
  const capabilityLabel = text(
    capability.status === "Available"
      ? "可用"
      : capability.status === "ProgramUpgradeRequired"
        ? "需要程序升级"
        : capability.status === "EndpointUnavailable"
          ? "接口不可用"
          : "配置错误",
    capability.status,
  );
  const title = !capabilityChecked
    ? text("正在核验链上托管能力", "Verifying on-chain Escrow capability")
    : available
      ? text("链上托管可用", "On-chain Escrow available")
      : capability.status === "ProgramUpgradeRequired"
        ? text("需要程序升级", "Program Upgrade Required")
        : capability.status === "EndpointUnavailable"
          ? text("能力核验不可用", "Capability check unavailable")
          : text("托管配置错误", "Escrow configuration error");
  const description = !capabilityChecked
    ? text("正在从公开程序源码与当前版本核验托管协议 v2；不会启用钱包操作或回退到本地状态。", "Verifying Escrow v2 from the public Program source and current edition. No Wallet Action is enabled and there is no local-state fallback.")
    : available
      ? text("已检测到 Credits 托管与负责任披露映射。已支付状态仍必须以交易确认和映射验证为准。", "Credits Escrow and Responsible Disclosure mappings are detected. Paid still requires a Confirmed Transaction and Mapping Verified.")
      : capability.status === "ProgramUpgradeRequired"
        ? text("当前公开程序尚未满足托管协议 v2 能力要求，因此奖励锁定与已支付状态保持不可用。", "The public Program does not meet Escrow v2 capability requirements, so RewardLocked / Paid remain unavailable.")
        : text("公开程序节点接口暂时无法完成能力核验。系统不会把节点错误解释为托管协议未部署，也不会回退到演示状态。", "The public Program endpoint cannot complete capability verification right now. A node error is not treated as an undeployed Escrow and there is no Demo fallback.");

  return (
    <section className="surface-card rounded-lg p-5" aria-labelledby="reward-escrow-status-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300">
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="page-kicker">{text("链上支付能力", "On-chain payment capability")}</p>
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
              : capabilityChecked
                ? "border-amber-300/20 bg-amber-300/[0.07] text-amber-100"
                : "border-cyan-300/20 bg-cyan-300/[0.07] text-cyan-100"
          }`}
        >
          <CircleDollarSign size={14} aria-hidden="true" />
          {available ? text("链上能力已验证", "On-chain capability verified") : capabilityChecked ? text("链上支付尚未激活", "On-chain payment is not active") : text("正在核验", "Verifying")}
        </span>
      </div>
      <details className="group mt-4 border-t border-white/10 pt-3">
        <summary className="focus-ring min-h-11 cursor-pointer list-none py-2 text-xs font-semibold text-slate-400 hover:text-white [&::-webkit-details-marker]:hidden">
          {available ? text("查看已启用的程序入口", "View enabled Program entries") : text("查看程序入口与核验状态", "View Program entries and verification status")}
        </summary>
        <div className="grid gap-3 pt-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          {[...REWARD_ESCROW_FUNCTIONS, ...RESPONSIBLE_DISCLOSURE_FUNCTIONS].map((functionName) => (
            <div className="min-w-0" key={functionName}>
              <p className="text-slate-500">{text("程序入口", "Program entry")}</p>
              <p className="mt-1 break-all font-mono text-slate-300">{functionName}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">
          <p>
            {text(
              `已支付状态必须同时满足交易已确认与映射已验证；当前不会回退到模拟数据或浏览器本地存储。能力状态：${capabilityLabel}。`,
              `Paid requires both a confirmed transaction and verified Mapping. There is no Mock or localStorage fallback. Capability: ${capability.status}.`,
            )}
          </p>
          <p>
            {text("链上分诊能力：", "On-chain triage: ")}{capabilityLabel}。{text("真实模式权限来自", "Real Mode authority comes from")}
            <span className="mx-1 font-mono text-slate-300">std::ctx::signer()</span>
            {text("与程序映射；本地演示预览不具备链上授权能力。", "and Program Mapping; Demo Preview has no on-chain authority.")}
          </p>
        </div>
      </details>
    </section>
  );
}
