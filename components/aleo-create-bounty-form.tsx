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

export function AleoCreateBountyForm() {
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
  const [lowReward, setLowReward] = useState("500000");
  const [deadlineBlocks, setDeadlineBlocks] = useState("100000");
  const [feeMicrocredits, setFeeMicrocredits] = useState(
    String(DEFAULT_CREATE_BOUNTY_FEE_MICROCREDITS),
  );
  const [preview, setPreview] = useState<CreateBountyTransactionPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selectedRule = getDemoVaultRule(ruleId);

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
      setMessage("无法生成公开 Bounty ID 或 Scope Hash，请检查 Scope。");
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
      setMessage(error instanceof Error ? error.message : "交易参数无效。");
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
    } catch {
      setMessage("Wallet 未接受交易请求。没有任何链上成功状态被写入本地。");
    } finally {
      setSubmitting(false);
    }
  }

  const canRequestWallet =
    wallet.connectionState === "Connected" &&
    network.kind === "available" &&
    preview !== null &&
    !submitting;

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-labelledby="real-create-bounty-title">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-semibold text-cyan-100">
              Aleo Testnet
            </span>
            <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-2 py-1 text-xs text-cyan-100">
              Wallet signature required
            </span>
          </div>
          <h2 id="real-create-bounty-title" className="mt-3 text-xl font-semibold text-white">
            钱包签名创建链上 Bounty
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Owner 只来自 Program 的 <span className="font-mono text-slate-200">self.signer</span>。Vercel、WSL
            和前端均不代签，也不会接收 Private Key。
          </p>
        </div>
        <NetworkBadge network={network} onRefresh={() => void refreshNetwork()} />
      </div>

      <div className="mt-5 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
        <p className="text-sm font-semibold text-cyan-50">
          {wallet.address && wallet.connectionState === "Connected"
            ? "当前连接的钱包将作为 Bounty Owner 创建"
            : "连接钱包后，该地址将作为 Bounty Owner 创建"}
        </p>
        <p className="mt-1 break-all text-xs leading-5 text-slate-400">
          {wallet.address && wallet.connectionState === "Connected"
            ? `${wallet.address} · Program 通过 self.signer 确认 Owner`
            : "真实权限只取决于钱包签名者与链上 Program，不读取 Demo Preview 身份。"}
        </p>
      </div>

      <form className="mt-5 grid gap-5" onSubmit={handlePreview}>
        <label className="grid gap-2 text-sm text-slate-300">
          安全规则（Public）
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
              <option className="bg-slate-950" key={rule.id} value={rule.id}>{rule.name}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-slate-300">
          Scope（仅用于生成 Public Scope Hash）
          <textarea
            className="focus-ring input-surface min-h-24 rounded-lg px-3 py-3"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
              setScopeHash("");
              setPreview(null);
            }}
            required
          />
        </label>

        <div className="grid gap-3 border-y border-white/10 py-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <ReadOnlyField label="Bounty ID" value={bountyId || "尚未生成"} />
          <ReadOnlyField label="Scope Hash" value={scopeHash || "尚未生成"} />
          <button className="focus-ring secondary-action" type="button" onClick={() => void generatePublicIdentifiers()}>
            <Hash size={16} aria-hidden="true" />
            生成公开标识
          </button>
          <p className="text-xs leading-5 text-slate-500 md:col-span-3">
            Bounty ID 使用浏览器安全随机数；Scope 明文不保存、不入链，仅将 SHA-256/128 field commitment 作为公开交易参数。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Critical Reward (microcredits)" value={criticalReward} onChange={setCriticalReward} />
          <NumberField label="High Reward (microcredits)" value={highReward} onChange={setHighReward} />
          <NumberField label="Medium Reward (microcredits)" value={mediumReward} onChange={setMediumReward} />
          <NumberField label="Low Reward (microcredits)" value={lowReward} onChange={setLowReward} />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <NumberField label="有效期（Blocks）" value={deadlineBlocks} onChange={setDeadlineBlocks} min="100" />
          <ReadOnlyField label="Disclosure Deadline Height" value={deadlineHeight === null ? "等待网络高度" : String(deadlineHeight)} />
          <NumberField label="预计 Public Fee (microcredits)" value={feeMicrocredits} onChange={setFeeMicrocredits} min="1" />
        </div>

        <div className="grid gap-3 border-t border-white/10 pt-5 text-sm sm:grid-cols-3">
          <ProtocolFact label="Program" value={CANONICAL_ALEO_PROGRAM_ID} mono />
          <ProtocolFact label="Invariant" value={selectedRule.invariantText} mono />
          <ProtocolFact label="资金状态" value="Not Escrowed" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="focus-ring secondary-action" type="submit">
            <ShieldCheck size={16} aria-hidden="true" />
            生成 Transaction Preview
          </button>
          <span className="text-xs leading-5 text-amber-200/80">
            Reward 数值仅写入 Registry；Iteration 5 不锁定 Credits。
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
            {submitting ? "等待 Wallet" : "请求 Wallet 签名"}
            {!submitting ? <ArrowRight size={16} aria-hidden="true" /> : null}
          </button>
          {wallet.connectionState !== "Connected" ? (
            <p className="text-xs text-slate-500">请先在顶部连接 Leo Wallet，并确认 Testnet 网络。</p>
          ) : null}
        </TransactionPreview>
      ) : null}
    </section>
  );
}

function NetworkBadge({ network, onRefresh }: { network: NetworkState; onRefresh: () => void }) {
  const available = network.kind === "available";
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${available ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
        {network.kind === "loading" ? <LoaderCircle className="animate-spin" size={14} aria-hidden="true" /> : <Radio size={14} aria-hidden="true" />}
        {available ? `Testnet #${network.latestHeight.toLocaleString()}` : network.kind === "loading" ? "检查 Testnet" : "Testnet Unavailable"}
      </span>
      {network.kind === "unavailable" ? (
        <button className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300" type="button" onClick={onRefresh} aria-label="重新检查 Testnet" title="重新检查 Testnet">
          <RefreshCw size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function TransactionPreview({ preview, children }: { preview: CreateBountyTransactionPreview; children: ReactNode }) {
  const labels = ["bounty_id", "scope_hash", "rule_id", "critical_reward", "high_reward", "medium_reward", "low_reward", "disclosure_deadline"];
  return (
    <div className="terminal-panel mt-6 rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-2 border-b border-cyan-300/15 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-kicker text-[0.68rem]">Transaction Preview</p>
          <h3 className="mt-2 text-lg font-semibold text-white">create_bounty / Aleo Testnet</h3>
        </div>
        <span className="text-xs font-semibold text-amber-200">Submitted ≠ Confirmed ≠ Mapping Verified</span>
      </div>
      <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">
        <PreviewRow label="Program" value={preview.programId} />
        <PreviewRow label="Function" value={preview.functionName} />
        <PreviewRow label="Owner" value={preview.ownerSource} />
        <PreviewRow label="Public Fee" value={`${preview.feeMicrocredits} microcredits`} />
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
