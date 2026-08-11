"use client";

import Link from "next/link";
import { ExternalLink, Fingerprint, Radio, ShieldCheck } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { ALEO_TESTNET_DEPLOYMENT } from "@/lib/aleo-program";

export function SiteFooter() {
  const { text } = useLocale();
  const workflowLinks = [
    { href: "/create-bounty", label: text("创建赏金", "Create Bounty") },
    { href: "/submit-proof", label: text("提交隐私证明", "Submit Private Proof") },
    { href: "/triage", label: text("负责任披露", "Responsible Disclosure") },
    { href: "/public-claims", label: text("公开注册表", "Public Registry") },
  ];

  return (
    <footer className="mt-10 border-t border-white/[0.08] bg-[#05070b]/60">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.25fr_0.75fr_0.9fr] lg:px-8">
        <div>
          <Link className="inline-flex items-center gap-3" href="/">
            <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-lg">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">zkBugBounty</span>
              <span className="mt-0.5 block text-xs text-slate-500">{text("隐私保护披露", "Privacy-preserving disclosure")}</span>
            </span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            {text(
              "白帽研究员可以证明漏洞存在，而无需把利用细节、私有见证或报告者秘密暴露给公开界面。",
              "Whitehats can prove a bug exists without exposing the Exploit, Private Witness, or Reporter Secret to the public interface.",
            )}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-300">{text("工作流", "Workflow")}</p>
          <nav aria-label={text("页脚工作流导航", "Footer workflow navigation")} className="mt-3 grid gap-2">
            {workflowLinks.map((link) => (
              <Link
                className="w-fit text-sm text-slate-500 transition hover:text-emerald-100"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-300">{text("协议状态", "Protocol status")}</p>
          <div className="mt-3 grid gap-3 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Radio className="text-emerald-300" size={14} aria-hidden="true" />
              Aleo Testnet
            </span>
            <span className="inline-flex items-center gap-2">
              <Fingerprint className="text-cyan-300" size={14} aria-hidden="true" />
              {text("漏洞声明收据 + 防重复标识", "Claim Receipt + Nullifier")}
            </span>
            <a
              className="inline-flex w-fit items-center gap-2 text-cyan-200 transition hover:text-cyan-100"
              href={ALEO_TESTNET_DEPLOYMENT.programExplorerUrl}
              rel="noreferrer"
              target="_blank"
            >
              {text("查看程序", "View Program")}
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>{text("zkBugBounty · Aleo 测试网协议演示", "zkBugBounty · Aleo Testnet protocol demo")}</p>
          <p className="max-w-full truncate font-mono" title={ALEO_TESTNET_DEPLOYMENT.programId}>
            {ALEO_TESTNET_DEPLOYMENT.programId}
          </p>
        </div>
      </div>
    </footer>
  );
}
