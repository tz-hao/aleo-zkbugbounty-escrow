"use client";

import { BadgeCheck, Gavel, KeyRound, ShieldAlert } from "lucide-react";

import { useLocale } from "./locale-provider";

export function ProtocolV3Workflow() {
  const { text } = useLocale();
  const stages = [
    [text("公开收据", "Public receipt"), text("项目方审核资格，不是最终漏洞确认", "Eligibility for Owner review, not a final vulnerability finding")],
    [text("受理并锁款", "Accept + lock"), text("受理与冻结奖励是两个独立操作", "Accepting a Claim and reserving funds are separate actions")],
    [text("加密交付", "Encrypted delivery"), text("白帽交付密文；项目方本地解密并签名确认收到", "The Whitehat delivers ciphertext; the Owner decrypts locally and acknowledges delivery")],
    [text("复现与修复", "Reproduce + remediate"), text("项目方提交复现结论和修复承诺；白帽可以确认或提出异议", "The Owner records a reproduction result and patch commitment; the Whitehat may accept or dispute")],
    [text("仲裁与结算", "Arbitrate + settle"), text("不可变仲裁面板达到门槛后，合约按裁决释放或解锁资金", "An immutable panel reaches quorum, then the contract pays or unlocks escrow")],
  ] as const;

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-labelledby="protocol-v3-workflow-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="page-kicker text-violet-200">Protocol V3 design</p>
          <h2 id="protocol-v3-workflow-title" className="mt-2 text-xl font-semibold text-white">
            {text("从证明资格到可结算裁决", "From proof eligibility to a settleable decision")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {text(
              "公开收据只证明电路约束与链上归属。真实漏洞、复现和修复属于受时限约束的责任披露流程；任何争议由赏金创建时已公开且不可修改的仲裁面板处理。",
              "A public Receipt proves circuit constraints and on-chain provenance only. Real vulnerability, reproduction, and remediation are accountable, time-bounded disclosure steps. Disputes go to the immutable panel declared when the Bounty is created.",
            )}
          </p>
        </div>
        <span className="w-fit rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 font-mono text-xs text-emerald-100">v3 · Testnet Edition 4 verified</span>
      </div>

      <ol className="mt-5 grid gap-3 lg:grid-cols-5">
        {stages.map(([title, detail], index) => (
          <li className="rounded-lg border border-white/10 bg-white/[0.03] p-4" key={title}>
            <span className="font-mono text-xs text-cyan-200">0{index + 1}</span>
            <h3 className="mt-2 text-sm font-semibold text-white">{title}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-3 border-t border-white/10 pt-5 md:grid-cols-3">
        <WorkflowResponsibility icon={BadgeCheck} title={text("项目方", "Project Owner")} detail={text("审核、受理、锁款、确认收到、记录复现与修复承诺。", "Reviews, accepts, locks funds, acknowledges delivery, and records reproduction and remediation commitments.")} />
        <WorkflowResponsibility icon={KeyRound} title={text("白帽", "Whitehat")} detail={text("仅向项目方/争议面板加密交付细节；确认修复或发起异议。", "Encrypts details only for the Owner or a dispute panel; accepts remediation or opens a dispute.")} />
        <WorkflowResponsibility icon={Gavel} title={text("仲裁面板", "Arbitration Panel")} detail={text("创建赏金时配置为公开 2/3 或 3/3 门槛；投票决定驳回、维持或下调奖励档位。", "Configured publicly as a 2/3 or 3/3 threshold at Bounty creation; votes to reject, uphold, or reduce a reward tier.")} />
      </div>

      <p className="mt-4 flex items-start gap-2 border-l-2 border-amber-300/40 pl-3 text-xs leading-5 text-amber-100/80">
        <ShieldAlert className="mt-0.5 shrink-0" size={15} aria-hidden="true" />
        {text("Testnet Edition 4 已公开核验。修复争议在裁决窗口内未达仲裁门槛时，将确定性地回到“已确认复现”，而非永久卡在争议中；奖励仍保持锁定。", "Testnet Edition 4 is publicly verified. A remediation dispute without quorum by its decision deadline deterministically returns to Reproduction Confirmed instead of remaining stuck; the reward remains locked.")}
      </p>
    </section>
  );
}

function WorkflowResponsibility({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof BadgeCheck;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-white/10 p-4">
      <Icon className="mt-0.5 shrink-0 text-cyan-200" size={18} aria-hidden="true" />
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
      </div>
    </div>
  );
}
