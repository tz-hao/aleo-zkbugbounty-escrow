import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Fingerprint,
  LockKeyhole,
  Network,
  ReceiptText,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

import { AleoDeploymentStatus } from "./aleo-deployment-status";
import { AleoRegistryOverview } from "./aleo-registry-overview";
import { DEMO_VAULT_RULES } from "@/lib/demo-vault";
import { zh } from "@/lib/i18n/zh";

const protocolSteps = [
  "创建公开 Bounty",
  "在设备端输入 Private Witness",
  "Wallet 执行 Proof Program",
  "写入 Claim Receipt 与 Nullifier",
  "项目方进行 Responsible Disclosure",
];

const ruleDisplayNames: Record<string, string> = {
  "Vault Accounting Safety": "Vault 记账安全",
  "Claims vs Deposits Safety": "Claims 与 Deposits 安全",
  "Reward Reserve Safety": "Reward Reserve 安全",
  "Withdrawal Limit Safety": "Withdrawal Limit 安全",
};

export function Dashboard() {
  return (
    <div className="grid gap-6">
      <section className="professional-site-hero min-w-0 rounded-lg px-6 py-8 sm:px-8 sm:py-10">
        <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="min-w-0">
            <p className="page-kicker mb-4">零知识漏洞披露协议</p>
            <h1 className="max-w-4xl break-words text-4xl font-semibold leading-[1.08] text-white sm:text-6xl">
              {zh.home.title}
            </h1>
            <p className="mt-4 max-w-3xl font-mono text-sm font-semibold leading-6 text-cyan-100 sm:text-base">
              {zh.brand.slogan}
            </p>
            <p className="muted-copy mt-5 max-w-3xl text-base sm:text-lg">{zh.home.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="focus-ring primary-action" href="/create-bounty">
                以项目方身份创建 Bounty
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="focus-ring secondary-action" href="/submit-proof">
                以 Whitehat 身份提交 Claim
                <TerminalSquare size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="hidden border-l border-cyan-300/20 pl-6 lg:block">
            <p className="page-kicker">可信执行边界</p>
            <h2 className="mt-2 text-lg font-semibold text-white">钱包签名，Mapping 验收</h2>
            <div className="mt-5 divide-y divide-white/10">
              <BoundaryRow
                icon={LockKeyhole}
                label="Private Witness"
                value="仅存在于页面临时状态与 Wallet 调用栈"
              />
              <BoundaryRow
                icon={Fingerprint}
                label="Public Proof Artifacts"
                value="Commitment、Nullifier、Claim Receipt"
              />
              <BoundaryRow
                icon={Network}
                label="Protocol Authority"
                value="Aleo Testnet Program Mappings"
              />
            </div>
          </div>
        </div>
      </section>

      <AleoRegistryOverview />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <AleoDeploymentStatus />
        <section className="surface-card rounded-lg p-5 sm:p-6">
          <p className="page-kicker">安全规则</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Multi-Invariant DemoVault</h2>
          <div className="mt-4 divide-y divide-white/10">
            {DEMO_VAULT_RULES.map((rule) => (
              <div className="py-3 first:pt-0 last:pb-0" key={rule.id}>
                <h3 className="text-sm font-semibold text-white">
                  {ruleDisplayNames[rule.name] ?? rule.name}
                </h3>
                <p className="mt-1 break-words font-mono text-xs leading-5 text-cyan-100">
                  {rule.invariantText}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <details className="group surface-card rounded-lg">
        <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-5 py-4 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-sm font-semibold text-white">协议说明</p>
            <p className="mt-1 text-xs text-slate-500">查看 Proof artifacts 与披露流程</p>
          </div>
          <ChevronDown
            className="shrink-0 text-slate-400 transition group-open:rotate-180"
            size={18}
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-white/10 px-5 py-5">
          <ol className="grid gap-3 md:grid-cols-5">
            {protocolSteps.map((step, index) => (
              <li className="border-l border-cyan-300/25 pl-3 text-sm leading-6 text-slate-300" key={step}>
                <span className="block font-mono text-xs text-slate-600">0{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
            <ProtocolNote
              icon={ReceiptText}
              title="公开可验证"
              body="Claim Receipt 和 Nullifier 由 Testnet Mapping 读取；Confirmed 与 Mapping Verified 分开表达。"
            />
            <ProtocolNote
              icon={ShieldCheck}
              title="默认保密"
              body="Private Witness、Reporter Secret 与漏洞细节不进入 Store、URL、日志或 Public Metadata。"
            />
          </div>
        </div>
      </details>
    </div>
  );
}

function BoundaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[2rem_1fr] gap-3 py-3">
      <Icon className="mt-0.5 text-cyan-200" size={17} aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{value}</p>
      </div>
    </div>
  );
}

function ProtocolNote({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 shrink-0 text-emerald-200" size={18} aria-hidden="true" />
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
      </div>
    </div>
  );
}
