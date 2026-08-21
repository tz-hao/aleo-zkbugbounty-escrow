"use client";

import {
  ArrowRight,
  CircleAlert,
  Hash,
  LoaderCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  DEFAULT_CREATE_BOUNTY_FEE_MICROCREDITS,
  buildCreateBountyTransaction,
  createScopeFieldHash,
  generateBountyFieldId,
  type CreateBountyTransactionPreview,
} from "@/lib/aleo-create-bounty";
import { CANONICAL_ALEO_PROGRAM_ID } from "@/lib/aleo-program";
import { DEMO_VAULT_RULES, getDemoVaultRule } from "@/lib/demo-vault";
import type { DemoVaultRuleId } from "@/lib/models";
import { useAleoWallet } from "./aleo-wallet-provider";

import { useLocale } from "./locale-provider";

type NetworkState =
  | { kind: "loading" }
  | { kind: "available"; latestHeight: number }
  | { kind: "unavailable" };

async function fetchNetworkState(): Promise<NetworkState> {
  try {
    const response = await fetch("/api/aleo/network", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const payload = (await response.json()) as {
      network?: { status?: string; network?: string; walletChainId?: string; latestHeight?: number };
    };
    if (
      !response.ok ||
      payload.network?.status !== "Available" ||
      payload.network.network !== "testnet" ||
      payload.network.walletChainId !== "testnetbeta" ||
      typeof payload.network.latestHeight !== "number" ||
      !Number.isSafeInteger(payload.network.latestHeight)
    ) {
      return { kind: "unavailable" };
    }
    return { kind: "available", latestHeight: payload.network.latestHeight };
  } catch {
    return { kind: "unavailable" };
  }
}

export function AleoCreateBountyForm({ legacy = false }: { legacy?: boolean }) {
  const router = useRouter();
  const wallet = useAleoWallet();
  const [network, setNetwork] = useState<NetworkState>({ kind: "loading" });
  const [scope, setScope] = useState("Vault accounting logic");
  const [ruleId, setRuleId] = useState<DemoVaultRuleId>("vault-accounting-safety");
  const [bountyId, setBountyId] = useState("");
  const [scopeHash, setScopeHash] = useState("");
  const [criticalReward, setCriticalReward] = useState("5000000");
  const [highReward, setHighReward] = useState("2000000");
  const [mediumReward, setMediumReward] = useState("1000000");
  const lowReward = "0";
  const [deadlineBlocks, setDeadlineBlocks] = useState("100000");
  const [feeMicrocredits, setFeeMicrocredits] = useState(
    String(DEFAULT_CREATE_BOUNTY_FEE_MICROCREDITS),
  );
  const [preview, setPreview] = useState<CreateBountyTransactionPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selectedRule = getDemoVaultRule(ruleId);
  const { copy, text } = useLocale();
  const selectedRuleCopy = copy.rules[ruleId];

  async function refreshNetwork() {
    setNetwork({ kind: "loading" });
    setNetwork(await fetchNetworkState());
  }

  useEffect(() => {
    let active = true;
    void fetchNetworkState().then((nextState) => {
      if (active) setNetwork(nextState);
    });
    return () => {
      active = false;
    };
  }, []);

  const deadlineHeight = useMemo(() => {
    if (network.kind !== "available" || !/^[0-9]+$/.test(deadlineBlocks)) return null;
    const value = network.latestHeight + Number(deadlineBlocks);
    return Number.isSafeInteger(value) ? value : null;
  }, [deadlineBlocks, network]);

  async function generatePublicIdentifiers() {
    setMessage(null);
    try {
      const nextBountyId = generateBountyFieldId((bytes) => crypto.getRandomValues(bytes));
      const nextScopeHash = await createScopeFieldHash(
        scope,
        ruleId,
        (algorithm, data) => crypto.subtle.digest(algorithm, data),
      );
      setBountyId(nextBountyId);
      setScopeHash(nextScopeHash);
      setPreview(null);
    } catch {
      setMessage(text("无法生成公开赏金编号或范围哈希，请检查漏洞范围。", "Unable to generate the public Bounty ID or Scope Hash. Check the Scope."));
    }
  }

  function createPreview() {
    if (network.kind !== "available" || deadlineHeight === null) {
      throw new Error("Aleo Testnet network check must pass before building a transaction");
    }
    return buildCreateBountyTransaction(
      {
        bountyId,
        scopeHash,
        ruleId,
        criticalReward,
        highReward,
        mediumReward,
        lowReward,
        disclosureDeadline: deadlineHeight,
        feeMicrocredits: Number(feeMicrocredits),
      },
      network.latestHeight,
    );
  }

  function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      setPreview(createPreview());
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : text("交易参数无效。", "The transaction parameters are invalid."));
    }
  }

  async function handleWalletRequest() {
    setSubmitting(true);
    setMessage(null);
    try {
      const currentPreview = createPreview();
      setPreview(currentPreview);
      await wallet.submitCreateBounty(currentPreview);
      router.push(`/create-bounty/result?bountyId=${encodeURIComponent(currentPreview.publicInputs.bountyId)}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Transaction could not be completed. No on-chain success state was recorded.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canRequestWallet =
    wallet.connectionState === "Connected" &&
    network.kind === "available" &&
    preview !== null &&
    !submitting &&
    !wallet.transactionSubmissionBlocked;

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-labelledby="real-create-bounty-title">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">
              {legacy ? "Protocol V2 · Compatibility" : "Aleo Testnet"}
            </span>
            <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-2 py-1 text-xs text-cyan-100">
              {text("需要钱包签名", "Wallet signature required")}
            </span>
          </div>
          <h2 id="real-create-bounty-title" className="mt-3 text-xl font-semibold text-white">
            {legacy
              ? text("创建兼容 V2 赏金", "Create a compatible V2 Bounty")
              : text("通过钱包签名创建链上赏金", "Create an on-chain Bounty with a Wallet signature")}
          </h2>
          {legacy ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/75">
              {text(
                "仅当需要继续处理旧 V2 收据或旧流程时使用。新建赏金请返回“V3 当前协议”，以获得仲裁、加密交付和完整结算流程。",
                "Use this only for existing V2 receipts or workflows. Create new Bounties with the V3 current protocol for arbitration, encrypted delivery, and the full settlement flow.",
              )}
            </p>
          ) : null}
        </div>
        <NetworkBadge network={network} onRefresh={() => void refreshNetwork()} />
      </div>

      <form className="mt-5 grid gap-5" onSubmit={handlePreview}>
        <label className="grid gap-2 text-sm text-slate-300">
          {text("安全规则（公开）", "Security rule (public)")}
          <select
            className="focus-ring input-surface rounded-lg px-3 py-3"
            value={ruleId}
            onChange={(event) => {
              setRuleId(event.target.value as DemoVaultRuleId);
              setScopeHash("");
              setPreview(null);
            }}
          >
            {DEMO_VAULT_RULES.map((rule) => (
              <option className="bg-slate-950" key={rule.id} value={rule.id}>{copy.rules[rule.id].name}</option>
            ))}
          </select>
          <span className="text-xs leading-5 text-slate-500">
            <span className="font-medium text-slate-300">{selectedRuleCopy.name}</span>{text("：", ": ")}{selectedRuleCopy.description}
          </span>
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          {text("漏洞范围（仅用于生成公开范围哈希）", "Scope (used only to generate the public Scope Hash)")}
          <textarea
            className="focus-ring input-surface min-h-24 rounded-lg px-3 py-3"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
              setScopeHash("");
              setPreview(null);
            }}
            placeholder={text("例如：金库记账逻辑", "Example: Vault accounting logic")}
            required
          />
          <span className="text-xs leading-5 text-slate-500">
            {text("仅用于生成公开范围哈希。不要填写利用细节、概念验证、触发参数或其他敏感信息。", "Used only to generate a public Scope Hash. Do not enter an Exploit, PoC, triggering parameters, or other sensitive data.")}
          </span>
        </label>

        <div className="grid gap-3 border-y border-white/10 py-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <ReadOnlyField label={text("赏金编号", "Bounty ID")} value={bountyId || text("尚未生成", "Not generated")} />
          <ReadOnlyField label={text("范围哈希", "Scope Hash")} value={scopeHash || text("尚未生成", "Not generated")} />
          <button className="focus-ring secondary-action" type="button" onClick={() => void generatePublicIdentifiers()}>
            <Hash size={16} aria-hidden="true" />
            {text("生成公开标识", "Generate public identifiers")}
          </button>
          <p className="text-xs leading-5 text-slate-500 md:col-span-3">
            {text("赏金编号使用浏览器安全随机数；漏洞范围明文不保存、不入链，仅将 SHA-256/128 field 承诺作为公开交易参数。", "Bounty ID uses browser-secure randomness. The raw Scope is neither stored nor written on-chain; only a SHA-256/128 field commitment is a public transaction input.")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label={text("严重级奖励（microcredits）", "Critical reward (microcredits)")} value={criticalReward} onChange={setCriticalReward} />
          <NumberField label={text("高危奖励（microcredits）", "High reward (microcredits)")} value={highReward} onChange={setHighReward} />
          <NumberField label={text("中危奖励（microcredits）", "Medium reward (microcredits)")} value={mediumReward} onChange={setMediumReward} />
          <ReadOnlyField label={text("低危奖励（不可领取）", "Low reward (not claimable)")} value="0 microcredits" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <NumberField label={text("有效期（区块数）", "Validity (blocks)")} value={deadlineBlocks} onChange={setDeadlineBlocks} min="100" />
          <ReadOnlyField label={text("披露期限区块高度", "Disclosure Deadline Height")} value={deadlineHeight === null ? text("等待网络高度", "Waiting for network height") : String(deadlineHeight)} />
          <NumberField label={text("交易费（microcredits）", "Transaction fee (microcredits)")} value={feeMicrocredits} onChange={setFeeMicrocredits} min="1" />
        </div>

        <div className="grid gap-3 border-t border-white/10 pt-5 text-sm sm:grid-cols-3">
          <ProtocolFact label={text("程序", "Program")} value={CANONICAL_ALEO_PROGRAM_ID} mono />
          <ProtocolFact label={text("安全不变量", "Invariant")} value={selectedRule.invariantText} mono />
          <ProtocolFact label={text("资金状态", "Funding status")} value={text("等待充值赏金（尚未进入托管）", "Awaiting Fund Bounty (not in Escrow)")} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="focus-ring secondary-action" type="submit">
            <ShieldCheck size={16} aria-hidden="true" />
            {text("生成交易预览", "Generate transaction preview")}
          </button>
          <span className="text-xs leading-5 text-amber-200/80">
            {text("创建操作只登记奖励档位；链上 Credits 需在确认后通过 fund_bounty_v2 单独注入托管。", "Creation registers reward tiers only. After confirmation, on-chain Credits must be deposited into Escrow separately through fund_bounty_v2.")}
          </span>
        </div>
      </form>



      {message ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/[0.08] p-3 text-sm text-red-100" role="alert">
          <CircleAlert className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
          {message}
        </p>
      ) : null}

      {preview ? (
        <TransactionPreview preview={preview}>
          <button
            className="focus-ring primary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
            type="button"
            disabled={!canRequestWallet}
            onClick={() => void handleWalletRequest()}
          >
            {submitting ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <WalletCards size={16} aria-hidden="true" />}
            {submitting ? text("等待钱包响应", "Waiting for Wallet") : text("请求钱包签名", "Request Wallet signature")}
            {!submitting ? <ArrowRight size={16} aria-hidden="true" /> : null}
          </button>
          {wallet.connectionState !== "Connected" ? (
            <p className="text-xs text-slate-500">{text("请先在顶部连接 Leo Wallet，并确认已切换到 Aleo 测试网。", "Connect Leo Wallet in the header and confirm Aleo Testnet first.")}</p>
          ) : null}
        </TransactionPreview>
      ) : null}
    </section>
  );
}

function NetworkBadge({ network, onRefresh }: { network: NetworkState; onRefresh: () => void }) {
  const available = network.kind === "available";
  const { text } = useLocale();
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${available ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
        {network.kind === "loading" ? <LoaderCircle className="animate-spin" size={14} aria-hidden="true" /> : <Radio size={14} aria-hidden="true" />}
        {available ? text(`测试网 #${network.latestHeight.toLocaleString()}`, `Testnet #${network.latestHeight.toLocaleString()}`) : network.kind === "loading" ? text("正在检查测试网", "Checking Testnet") : text("测试网暂不可用", "Testnet unavailable")}
      </span>
      {network.kind === "unavailable" ? (
        <button className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300" type="button" onClick={onRefresh} aria-label={text("重新检查测试网", "Recheck Testnet")} title={text("重新检查测试网", "Recheck Testnet")}>
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function TransactionPreview({ preview, children }: { preview: CreateBountyTransactionPreview; children: ReactNode }) {
  const { text } = useLocale();
  const labels = ["bounty_id", "scope_hash", "rule_id", "critical_reward", "high_reward", "medium_reward", "low_reward", "disclosure_deadline"];
  return (
    <div className="terminal-panel mt-6 rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 border-b border-cyan-300/15 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-kicker text-[0.68rem]">{text("交易预览", "Transaction Preview")}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">create_bounty / {text("Aleo 测试网", "Aleo Testnet")}</h3>
        </div>
        <span className="text-xs font-semibold text-amber-200">{text("已提交 ≠ 已确认 ≠ 映射已核验", "Submitted ≠ Confirmed ≠ Mapping verified")}</span>
      </div>
      <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
        <PreviewRow label={text("程序编号", "Program")} value={preview.programId} />
        <PreviewRow label={text("函数", "Function")} value={preview.functionName} />
        <PreviewRow label={text("钱包来源", "Wallet source")} value={preview.ownerSource} />
        <PreviewRow label={text("交易费用", "Transaction Fee")} value={`${preview.feeMicrocredits} microcredits`} />
        {preview.inputs.map((value, index) => <PreviewRow key={labels[index]} label={labels[index]} value={value} />)}
      </dl>
      <div className="mt-5 flex flex-col items-start gap-3 border-t border-cyan-300/15 pt-4">{children}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, min = "0" }: { label: string; value: string; onChange: (value: string) => void; min?: string }) {
  return <label className="grid gap-2 text-sm text-slate-300">{label}<input className="focus-ring input-surface rounded-lg px-3 py-3" type="number" min={min} step="1" value={value} onChange={(event) => onChange(event.target.value)} required /></label>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 break-all font-mono text-sm text-slate-200">{value}</p></div>;
}

function ProtocolFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 break-all text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</p></div>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <div className="grid min-w-0 grid-cols-[9rem_1fr] gap-3 border-b border-white/[0.07] py-2 text-xs"><dt className="font-mono text-slate-500">{label}</dt><dd className="break-all font-mono text-cyan-50">{value}</dd></div>;
}
