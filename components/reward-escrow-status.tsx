import { CircleDollarSign, LockKeyhole } from "lucide-react";

import { REWARD_ESCROW_CAPABILITY, REWARD_ESCROW_FUNCTIONS } from "@/lib/aleo-reward-escrow";
import { ON_CHAIN_TRIAGE_CAPABILITY } from "@/lib/aleo-triage";

export function RewardEscrowStatus() {
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
              Awaiting Program Upgrade
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              当前 Testnet 继续支持 Bounty、Claim Receipt 与 Nullifier 验证；Credits Escrow 尚未部署，
              本地 RewardLocked / Paid 状态不代表资金已锁定或支付。
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs font-semibold text-amber-100">
          <CircleDollarSign size={14} aria-hidden="true" />
          链上支付操作未启用
        </span>
      </div>
      <details className="group mt-4 border-t border-white/10 pt-3">
        <summary className="focus-ring min-h-11 cursor-pointer list-none py-2 text-xs font-semibold text-slate-400 hover:text-white [&::-webkit-details-marker]:hidden">
          查看待启用的 Program 入口
        </summary>
        <div className="grid gap-3 pt-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          {REWARD_ESCROW_FUNCTIONS.map((functionName) => (
            <div className="min-w-0" key={functionName}>
              <p className="text-slate-500">Program entry</p>
              <p className="mt-1 break-all font-mono text-slate-300">{functionName}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">
          <p>
            Paid 必须同时满足 Confirmed Transaction 与 Mapping Verified；当前不会回退到 Mock 或
            localStorage。Capability: {REWARD_ESCROW_CAPABILITY.status}.
          </p>
          <p>
            On-chain Triage: {ON_CHAIN_TRIAGE_CAPABILITY.status}. Real Mode 权限来自
            <span className="mx-1 font-mono text-slate-300">self.signer</span>与 Program Mapping；
            Demo Preview 不具备链上授权能力。
          </p>
        </div>
      </details>
    </section>
  );
}
