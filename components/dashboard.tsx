import Link from "next/link";
import {
  ArrowRight,
  Braces,
  Check,
  ChevronDown,
  Code2,
  EyeOff,
  Fingerprint,
  Gauge,
  Network,
  ReceiptText,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

import { AleoDeploymentStatus } from "./aleo-deployment-status";
import { AleoRegistryOverview } from "./aleo-registry-overview";
import { HeroProofVisual } from "./hero-proof-visual";
import { SpotlightCard } from "./spotlight-card";
import { DEMO_VAULT_RULES } from "@/lib/demo-vault";
import { zh } from "@/lib/i18n/zh";

const protocolSteps = [
  "创建公开 Bounty",
  "设备端准备 Private Input",
  "Wallet 执行 Proof Program",
  "写入 Receipt 与 Nullifier",
  "推进 Responsible Disclosure",
];

const ruleDisplayNames: Record<string, string> = {
  "Vault Accounting Safety": "Vault 记账安全",
  "Claims vs Deposits Safety": "Claims 与 Deposits 安全",
  "Reward Reserve Safety": "Reward Reserve 安全",
  "Withdrawal Limit Safety": "Withdrawal Limit 安全",
};

const architectureRows = [
  {
    label: "敏感证据",
    traditional: "进入平台或私有沟通渠道",
    publicChain: "直接提交会暴露 Call Data",
    zkBugBounty: "留在设备与 Wallet 调用边界",
  },
  {
    label: "公开验证",
    traditional: "依赖人工信任与平台判断",
    publicChain: "公开可查，但可能泄露细节",
    zkBugBounty: "Receipt、Commitment、Nullifier",
  },
  {
    label: "状态权威",
    traditional: "中心化数据库",
    publicChain: "公开链上状态",
    zkBugBounty: "Aleo Program Mappings",
  },
];

const protocolStack = [
  { icon: Network, label: "Aleo Testnet" },
  { icon: Code2, label: "Leo 4.0.2" },
  { icon: Fingerprint, label: "Leo Wallet" },
  { icon: ReceiptText, label: "Provable Explorer" },
  { icon: Braces, label: "Next.js App Router" },
];

export function Dashboard() {
  return (
    <div className="grid gap-9">
      <section className="professional-site-hero section-reveal min-w-0 rounded-lg p-4">
        <div className="relative grid min-h-[25rem] gap-7 lg:grid-cols-[1.03fr_0.97fr] lg:items-center">
          <div className="min-w-0 px-2 py-3 sm:px-4 lg:py-4">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-300/15 bg-emerald-300/[0.055] px-3 py-2 text-xs font-semibold text-emerald-100">
              <span className="network-pulse" aria-hidden="true" />
              Aleo Testnet · Canonical Program
            </div>

            <p className="page-kicker mb-4 mt-5">零知识漏洞披露协议</p>
            <h1 className="max-w-3xl break-words text-4xl font-semibold leading-[1.08] sm:text-5xl">
              <span className="gradient-heading block">证明漏洞存在，</span>
              <span className="gradient-heading-accent block">Exploit 无需公开</span>
            </h1>
            <p className="mt-5 max-w-3xl font-mono text-sm font-semibold leading-6 text-cyan-100/90 sm:text-base">
              {zh.brand.slogan}
            </p>
            <p className="muted-copy mt-4 max-w-2xl text-sm sm:text-base">{zh.home.description}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="focus-ring primary-action" href="/create-bounty">
                创建 Bounty
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="focus-ring secondary-action" href="/submit-proof">
                提交 Private Claim
                <TerminalSquare size={17} aria-hidden="true" />
              </Link>
            </div>

          </div>

          <HeroProofVisual />
        </div>
      </section>

      <section aria-labelledby="live-protocol-heading">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-kicker">Live Protocol</p>
            <h2
              className="mt-2 text-2xl font-semibold text-white sm:text-3xl"
              id="live-protocol-heading"
            >
              链上事实，而不是本地计数
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-slate-400">
            首页指标来自 Aleo Testnet Registry。公开节点不可用时，界面会明确降级，不使用 Mock
            或 localStorage 伪造协议状态。
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <AleoRegistryOverview />
          </div>
          <div className="min-w-0 lg:col-span-4">
            <AleoDeploymentStatus />
          </div>

          <SpotlightCard className="p-5 sm:p-6 lg:col-span-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="page-kicker">Multi-Invariant DemoVault</p>
                <h2 className="mt-2 text-xl font-semibold text-white">四条规则，共用一套 Proof 边界</h2>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-100">
                <ShieldCheck size={18} aria-hidden="true" />
              </span>
            </div>
            <div className="mt-5 grid gap-x-5 sm:grid-cols-2">
              {DEMO_VAULT_RULES.map((rule, index) => (
                <div
                  className="grid grid-cols-[1.75rem_1fr] gap-3 border-t border-white/[0.08] py-4"
                  key={rule.id}
                >
                  <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">
                      {ruleDisplayNames[rule.name] ?? rule.name}
                    </h3>
                    <p className="mt-1 break-words font-mono text-xs leading-5 text-cyan-100/80">
                      {rule.invariantText}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>

          <SpotlightCard className="terminal-panel p-5 sm:p-6 lg:col-span-5">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <p className="page-kicker">Canonical Leo</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Public receipt boundary</h2>
              </div>
              <span className="rounded-md border border-violet-300/15 bg-violet-300/[0.07] px-2.5 py-1.5 font-mono text-[0.68rem] text-violet-100">
                zkbugbounty_7f3c92.aleo
              </span>
            </div>
            <pre className="mt-5 overflow-x-auto font-mono text-[0.72rem] leading-6 text-slate-400">
              <code>
                <span className="text-violet-200">fn</span>{" "}
                <span className="text-cyan-100">submit_claim</span>({"\n"}
                {"  "}
                <span className="text-violet-200">public</span> bounty_id: field,{"\n"}
                {"  "}
                <span className="text-violet-200">public</span> scope_hash: field,{"\n"}
                {"  "}
                <span className="text-violet-200">public</span> rule_id: field,{"\n"}
                {"  "}...private inputs{"\n"}
                {") -> ("}
                <span className="text-violet-200">public</span> ProofResult, Final) {"{"}
                {"\n"}
                {"  "}assert(!Mapping::contains({"\n"}
                {"    "}nullifiers, nullifier{"\n"}
                {"  "}));{"\n"}
                {"  "}Mapping::set(claim_receipts,{"\n"}
                {"    "}claim_hash, receipt{"\n"}
                {"  "});{"\n"}
                {"}"}
              </code>
            </pre>
            <p className="mt-4 flex items-start gap-2 border-t border-white/[0.08] pt-4 text-xs leading-5 text-slate-500">
              <EyeOff className="mt-0.5 shrink-0 text-emerald-200" size={14} aria-hidden="true" />
              Public UI 只读取公开 Receipt 与状态；敏感输入不进入 Store、URL 或日志。
            </p>
          </SpotlightCard>
        </div>
      </section>

      <section className="surface-card overflow-hidden rounded-lg" aria-labelledby="comparison-heading">
        <div className="grid gap-4 border-b border-white/[0.08] p-5 sm:p-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <p className="page-kicker">Architecture Comparison</p>
            <h2 className="mt-2 text-2xl font-semibold text-white" id="comparison-heading">
              披露，不必等于公开漏洞
            </h2>
          </div>
          <p className="text-sm leading-6 text-slate-400">
            zkBugBounty 把“漏洞证据”和“公开可验证状态”拆开：前者留在受控边界，后者进入 Aleo
            Program Mappings。
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[46rem]">
            <div className="grid grid-cols-[0.62fr_1fr_1fr_1.08fr] border-b border-white/[0.08] bg-white/[0.018] text-xs font-semibold text-slate-500">
              <div className="p-4">维度</div>
              <div className="p-4">传统漏洞平台</div>
              <div className="p-4">公开链直接提交</div>
              <div className="border-l border-emerald-300/10 bg-emerald-300/[0.025] p-4 text-emerald-100">
                zkBugBounty · Aleo ZK
              </div>
            </div>
            {architectureRows.map((row) => (
              <div
                className="grid grid-cols-[0.62fr_1fr_1fr_1.08fr] border-b border-white/[0.06] text-sm last:border-b-0"
                key={row.label}
              >
                <div className="p-4 font-semibold text-white">{row.label}</div>
                <div className="p-4 leading-6 text-slate-500">{row.traditional}</div>
                <div className="p-4 leading-6 text-slate-400">{row.publicChain}</div>
                <div className="border-l border-emerald-300/10 bg-emerald-300/[0.018] p-4 leading-6 text-emerald-50">
                  <span className="flex items-start gap-2">
                    <Check className="mt-1 shrink-0 text-emerald-300" size={14} aria-hidden="true" />
                    {row.zkBugBounty}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-y border-white/[0.08] py-4" aria-label="协议技术栈">
        <div className="stack-marquee gap-3">
          {[0, 1].map((copy) => (
            <div className="flex gap-3 pr-3" aria-hidden={copy === 1} key={copy}>
              {protocolStack.map(({ icon: Icon, label }) => (
                <span
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-semibold text-slate-300"
                  key={`${copy}-${label}`}
                >
                  <Icon className="text-cyan-200" size={14} aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <details className="group surface-card rounded-lg">
        <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-5 py-4 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-sm font-semibold text-white">协议执行路径</p>
            <p className="mt-1 text-xs text-slate-500">查看 Private Boundary 到 Public Registry</p>
          </div>
          <ChevronDown
            className="shrink-0 text-slate-400 transition group-open:rotate-180"
            size={18}
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-white/[0.08] px-5 py-5">
          <ol className="grid gap-3 md:grid-cols-5">
            {protocolSteps.map((step, index) => (
              <li className="border-l border-cyan-300/20 pl-3 text-sm leading-6 text-slate-300" key={step}>
                <span className="block font-mono text-xs text-slate-600">0{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-5 grid gap-4 border-t border-white/[0.08] pt-5 md:grid-cols-2">
            <ProtocolNote
              icon={Gauge}
              title="公开状态按证据分级"
              body="Confirmed 与 Mapping Verified 分开表达；节点异常不会被解释为链上成功。"
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
