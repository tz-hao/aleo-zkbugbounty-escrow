"use client";

import { CircleCheckBig, CircleX } from "lucide-react";

import { assessPublicReceiptForV3 } from "@/lib/protocol-v3";
import type { OnChainClaimReceipt } from "@/lib/models";
import { useLocale } from "./locale-provider";

export function PublicReceiptBoundary({ receipt }: { receipt: OnChainClaimReceipt }) {
  const { text } = useLocale();
  const assessment = assessPublicReceiptForV3(receipt);
  const verifiedFacts = [
    text("声明与赏金、范围哈希及安全规则一致。", "The Claim is bound to this Bounty, Scope Hash, and safety rule."),
    text("零知识电路约束已通过验证。", "The zero-knowledge circuit constraints verified."),
    text("防重复标识已被链上登记。", "The anti-replay nullifier is recorded on-chain."),
    text(`证明给出了 ${assessment.recommendedSeverity} 档的建议严重程度。`, `The proof produced a ${assessment.recommendedSeverity} severity recommendation.`),
  ] as const;
  const unresolvedFacts = [
    text("真实目标是否存在该漏洞。", "Whether the real target contains this vulnerability."),
    text("项目方能否解密并复现技术细节。", "Whether the Owner can decrypt and reproduce the technical details."),
    text("补丁是否有效，以及应支付哪一档奖励。", "Whether the patch is effective and which reward tier should be paid."),
  ] as const;
  return (
    <section className="mt-5 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.04] p-4" aria-label={text("公开收据验证边界", "Public receipt verification boundary")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-50">{text("公开收据是审核资格，不是最终漏洞结论", "A public Receipt is review eligibility, not a final vulnerability finding")}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {assessment.eligibleForRewardLock
              ? text(`该收据可作为项目方审核与锁定 ${assessment.recommendedSeverity} 档奖励的链上前置条件；付款仍须经过加密披露、复现和结算。`, `This Receipt is an on-chain prerequisite for Owner review and a ${assessment.recommendedSeverity} reward reservation; payment still requires encrypted disclosure, reproduction, and settlement.`)
              : text("该收据尚未达到审核或锁款资格。", "This Receipt is not yet eligible for review or a reward reservation.")}
          </p>
        </div>
        <span className="w-fit rounded-md border border-cyan-300/25 px-2 py-1 font-mono text-xs text-cyan-100">V{receipt.protocolVersion}</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-emerald-100">{text("可公开确认", "Publicly confirmed")}</p>
          <ul className="grid gap-2 text-xs leading-5 text-slate-300">
            {verifiedFacts.map((fact) => <li className="flex gap-2" key={fact}><CircleCheckBig className="mt-0.5 shrink-0 text-emerald-300" size={14} />{fact}</li>)}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-amber-100">{text("仍需项目方或仲裁面板确认", "Still requires Owner or panel confirmation")}</p>
          <ul className="grid gap-2 text-xs leading-5 text-slate-300">
            {unresolvedFacts.map((fact) => <li className="flex gap-2" key={fact}><CircleX className="mt-0.5 shrink-0 text-amber-300" size={14} />{fact}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
