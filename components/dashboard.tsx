"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bug,
  Coins,
  Fingerprint,
  FileCheck2,
  Gavel,
  LockKeyhole,
  Network,
  ReceiptText,
  ShieldCheck,
  TerminalSquare,
  Users,
} from "lucide-react";
import { useAppState } from "./app-state-provider";
import { AleoDeploymentStatus } from "./aleo-deployment-status";
import { DEMO_VAULT_RULES } from "@/lib/demo-vault";
import { glossary } from "@/lib/i18n/glossary";
import { zh } from "@/lib/i18n/zh";
import { CANONICAL_ALEO_PROGRAM_ID } from "@/lib/aleo-program";

const roleFlow = [
  {
    title: glossary.projectOwner,
    body: "创建 Bounty，定义 Scope、安全 Invariant、Severity 奖励和披露期限。",
  },
  {
    title: glossary.whitehat,
    body: "在本地输入 Private Witness，生成 Proof 并提交公开 Claim Metadata。",
  },
  {
    title: "Proof Engine",
    body: `默认使用 Mock；配置 Local/Remote Leo Prover 后由 ${CANONICAL_ALEO_PROGRAM_ID} 执行，并明确标注验证级别。`,
  },
  {
    title: "漏洞分诊（Triage / Arbiter）",
    body: "查看 Severity、Proof Status、Witness Commitment 和 Claim Receipt，无法访问完整 Exploit。",
  },
  {
    title: "公开社区（Public Community）",
    body: "仅查看 Verified Claim、修复状态和支付状态，无法访问 Exploit 细节。",
  },
];

const protocolSteps = [
  "创建 Bounty",
  "提交 Private Witness",
  "Proof Engine 生成结果",
  "生成 Verified Claim",
  "Responsible Disclosure",
  "修复并释放 Bounty",
];

const protocolLayerSteps = [
  glossary.privateWitness,
  glossary.witnessCommitment,
  glossary.nullifier,
  "Claim Hash",
  glossary.claimReceipt,
  "Public Claim Registry",
];

const protocolLayerNotes = [
  "Witness Commitment 证明 Whitehat 已提交私有见证数据，但不会暴露其内容。",
  "Nullifier 用于阻止重复 Claim，同时隐藏 Reporter Secret。",
  "Claim Receipt 提供可审计的公开元数据；是否链上确认以 Verification Level 为准。",
  "Public Claim Registry 模拟 Aleo 的公开 Mapping。",
];

const multiInvariantRuleLabels = [
  "Vault Accounting Safety",
  "Claims vs Deposits Safety",
  "Reward Reserve Safety",
  "Withdrawal Limit Safety",
];

const ruleDisplayNames: Record<string, string> = {
  "Vault Accounting Safety": "Vault 记账安全（Vault Accounting Safety）",
  "Claims vs Deposits Safety": "Claims 与 Deposits 安全",
  "Reward Reserve Safety": "Reward Reserve 安全",
  "Withdrawal Limit Safety": "Withdrawal Limit 安全",
};

export function Dashboard() {
  const { state } = useAppState();
  const verifiedClaims = state.claims.filter((claim) => claim.proofStatus === "Verified");
  const totalRewards = state.bounties.reduce((sum, bounty) => sum + bounty.bountyAmount, 0);

  return (
    <div className="grid gap-7">
      <section className="professional-site-hero min-w-0 rounded-lg p-6 sm:p-8 lg:p-10">
        <div className="relative grid min-w-0 gap-8 lg:grid-cols-[1.03fr_0.97fr] lg:items-center">
          <div className="min-w-0 max-w-4xl">
            <p className="page-kicker mb-4">{zh.brand.englishSubtitle}</p>
            <h1 className="max-w-4xl break-words text-4xl font-semibold leading-[1.08] tracking-normal text-white sm:text-6xl">
              {zh.home.title}
            </h1>
            <p className="mt-4 font-mono text-sm font-semibold text-cyan-100 sm:text-base">{zh.brand.slogan}</p>
            <p className="muted-copy mt-5 max-w-3xl text-base sm:text-lg">
              {zh.home.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="focus-ring primary-action" href="/create-bounty">
                {zh.home.createAction}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="focus-ring secondary-action" href="/submit-proof">
                {zh.home.proofAction}
                <TerminalSquare size={17} aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-7 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <TrustSignal icon={LockKeyhole} label={zh.home.trustSignals[0]} />
              <TrustSignal icon={ReceiptText} label={zh.home.trustSignals[1]} />
              <TrustSignal icon={Network} label={zh.home.trustSignals[2]} />
            </div>
          </div>

          <div className="surface-card-strong min-w-0 rounded-lg p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-cyan-300/15 pb-4">
              <div>
                <p className="page-kicker text-[0.68rem]">{zh.home.deskLabel}</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{zh.home.deskTitle}</h2>
              </div>
              <span className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                {zh.home.verified}
              </span>
            </div>
            <div className="grid gap-3">
              <ProtocolDeskRow
                icon={Fingerprint}
                label="私有输入（Private Input）"
                value="仅由 Proof Engine 在当前流程中使用"
                tone="cyan"
              />
              <ProtocolDeskRow
                icon={TerminalSquare}
                label="Proof Engine"
                value="Mock Invariant Engine 或 Aleo Leo Proof"
                tone="violet"
              />
              <ProtocolDeskRow
                icon={ReceiptText}
                label="公开收据（Public Receipt）"
                value="Claim Hash + Commitment + Nullifier"
                tone="emerald"
              />
              <ProtocolDeskRow
                icon={Gavel}
                label="披露流程（Disclosure Rail）"
                value="请求细节、确认修复、释放 Bounty"
                tone="cyan"
              />
            </div>
            <div className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-sm font-semibold text-red-100">
              Critical 始终保持高辨识度；Exploit 数据始终隐藏。
            </div>
          </div>
        </div>
      </section>

      <AleoDeploymentStatus />

      <section className="grid gap-4 md:grid-cols-3">
        <Metric icon={ShieldCheck} label={zh.home.metrics[0]} value={state.bounties.length.toString()} />
        <Metric icon={Bug} label={zh.home.metrics[1]} value={verifiedClaims.length.toString()} />
        <Metric icon={Coins} label={zh.home.metrics[2]} value={`${totalRewards.toLocaleString()} ALEO`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        {roleFlow.map((role, index) => (
          <article className="surface-card rounded-lg p-4" key={role.title}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                {index === 0 ? <ShieldCheck size={18} /> : index === 1 ? <Users size={18} /> : index === 2 ? <TerminalSquare size={18} /> : index === 3 ? <Gavel size={18} /> : <FileCheck2 size={18} />}
              </div>
              <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
            </div>
            <h2 className="text-sm font-semibold text-white">{role.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{role.body}</p>
          </article>
        ))}
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-kicker mb-2 text-[0.68rem]">Responsible Disclosure Operations</p>
            <h2 className="text-xl font-semibold text-white">{zh.home.flowTitle}</h2>
          </div>
          <p className="text-sm text-slate-400">{zh.home.flowNote}</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-6">
          {protocolSteps.map((step) => (
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm font-medium text-slate-200" key={step}>
              {step}
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card-strong rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-kicker mb-2 text-[0.68rem]">Public Proof Artifacts</p>
            <h2 className="text-xl font-semibold text-white">{zh.home.protocolTitle}</h2>
          </div>
          <p className="text-sm text-slate-400">{zh.home.protocolNote}</p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-6">
          {protocolLayerSteps.map((step) => (
            <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-3 text-sm font-medium text-cyan-50" key={step}>
              {step}
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {protocolLayerNotes.map((note) => (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm leading-6 text-slate-300" key={note}>
              {note}
            </p>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6">
        <p className="page-kicker mb-2 text-[0.68rem]">Invariant Playground</p>
        <h2 className="text-xl font-semibold text-white">{zh.home.rulesTitle}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          {zh.home.rulesDescription}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {DEMO_VAULT_RULES.filter((rule) => multiInvariantRuleLabels.includes(rule.name)).map((rule) => (
            <article className="rounded-lg border border-white/10 bg-white/[0.035] p-3" key={rule.id}>
              <h3 className="text-sm font-semibold text-white">{ruleDisplayNames[rule.name] ?? rule.name}</h3>
              <p className="mt-2 font-mono text-xs text-cyan-100">{rule.invariantText}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{rule.affectedModule}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrustSignal({
  icon: Icon,
  label,
}: {
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
      <Icon size={15} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function ProtocolDeskRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  tone: "cyan" | "emerald" | "violet";
}) {
  const toneClass = {
    cyan: "border-cyan-300/20 bg-cyan-300/8 text-cyan-100",
    emerald: "border-emerald-300/20 bg-emerald-300/8 text-emerald-100",
    violet: "border-violet-300/20 bg-violet-300/8 text-violet-100",
  }[tone];

  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClass}`}>
        <Icon size={17} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-400">{value}</p>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-card rounded-lg p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/10 text-emerald-100">
          <Icon size={20} aria-hidden="true" />
        </div>
        <span className="h-px flex-1 bg-gradient-to-r from-emerald-300/25 to-transparent" />
      </div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
