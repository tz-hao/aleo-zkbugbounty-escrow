import { CircleDollarSign, LockKeyhole } from "lucide-react";

import { REWARD_ESCROW_CAPABILITY, REWARD_ESCROW_FUNCTIONS } from "@/lib/aleo-reward-escrow";
import { ON_CHAIN_TRIAGE_CAPABILITY } from "@/lib/aleo-triage";

export function RewardEscrowStatus() {
  return (
    <section className="surface-card rounded-lg p-5" aria-labelledby="reward-escrow-status-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-amber-100">
            <LockKeyhole size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="page-kicker text-[0.68rem] text-amber-200">Real Mode · Reward Escrow</p>
            <h2 id="reward-escrow-status-title" className="mt-2 text-lg font-semibold text-white">
              Program Upgrade Required
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              当前 Testnet Program 尚未部署 Credits Escrow。Demo 的 RewardLocked / Paid 仅用于本地流程演示，
              不代表资金已锁定或支付。
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-red-300/20 bg-red-400/[0.08] px-3 py-2 text-xs font-semibold text-red-100">
          <CircleDollarSign size={14} aria-hidden="true" />
          Wallet Actions Disabled
        </span>
      </div>
      <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        {REWARD_ESCROW_FUNCTIONS.map((functionName) => (
          <div className="min-w-0" key={functionName}>
            <p className="text-slate-500">Required entry</p>
            <p className="mt-1 break-all font-mono text-slate-300">{functionName}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Paid 必须同时满足 Confirmed Transaction 与 Mapping Verified；当前不会回退到 Mock 或 localStorage。
        Capability: {REWARD_ESCROW_CAPABILITY.status}.
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        On-chain Triage: {ON_CHAIN_TRIAGE_CAPABILITY.status}. Real Mode 权限来自
        <span className="mx-1 font-mono text-slate-300">self.signer</span>与 Program Mapping，Role Switcher
        仅控制 Demo UI。
      </p>
    </section>
  );
}
