"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  LoaderCircle,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import type { ConfirmedCreateBountyTransaction } from "@/lib/aleo-create-bounty-acceptance";
import {
  verifyCreateBountyMapping,
  type CreateBountyAcceptance,
} from "@/lib/aleo-create-bounty-verification";
import type { OnChainBountyState } from "@/lib/models";
import { useAleoWallet } from "./aleo-wallet-provider";
import { getLocalizedWalletMessage } from "@/lib/i18n/wallet";
import { useLocale } from "./locale-provider";

type VerificationState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "pending"; message: string }
  | { kind: "mapping-missing"; transaction: ConfirmedCreateBountyTransaction; message: string }
  | { kind: "unavailable"; message: string }
  | {
      kind: "verified";
      transaction: ConfirmedCreateBountyTransaction;
      bounty: OnChainBountyState;
      acceptance: CreateBountyAcceptance;
    };

type TransactionResponse = {
  transaction?: ConfirmedCreateBountyTransaction;
  error?: string;
  transactionStatus?: string;
};

type BountyResponse = { bounty?: OnChainBountyState; error?: string };

export function CreateBountyResult({ initialBountyId }: { initialBountyId: string }) {
  const wallet = useAleoWallet();
  const { text } = useLocale();
  const [transactionId, setTransactionId] = useState(wallet.submission?.publicTransactionId ?? "");
  const [bountyId, setBountyId] = useState(initialBountyId);
  const [state, setState] = useState<VerificationState>({ kind: "idle" });

  async function verifyPublicState(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTransactionId = transactionId.trim();
    const requestedBountyId = bountyId.trim();
    setState({ kind: "loading" });

    try {
      const transactionResponse = await fetch(
        `/api/aleo/transactions/${encodeURIComponent(normalizedTransactionId)}?intent=create_bounty`,
        { method: "GET", headers: { accept: "application/json" }, cache: "no-store" },
      );
      const transactionPayload = (await transactionResponse.json()) as TransactionResponse;
      if (transactionResponse.status === 404) {
        setState({
          kind: "pending",
          message: text("尚未查询到已确认交易。钱包已提交不等于链上确认，请稍后重试。", "Confirmed transaction is not indexed yet. Submitted does not equal on-chain confirmation; try again shortly."),
        });
        return;
      }
      if (!transactionResponse.ok || !transactionPayload.transaction) {
        setState({
          kind: "unavailable",
          message: transactionPayload.error ?? text("无法验证 Aleo 测试网交易。", "Unable to verify the Aleo Testnet transaction."),
        });
        return;
      }

      const transaction = transactionPayload.transaction;
      const mappingKey = requestedBountyId || transaction.publicInputs.bountyId;
      if (!requestedBountyId) setBountyId(mappingKey);
      const bountyResponse = await fetch(`/api/aleo/bounties/${encodeURIComponent(mappingKey)}`, {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      const bountyPayload = (await bountyResponse.json()) as BountyResponse;
      if (bountyResponse.status === 404) {
        setState({
          kind: "mapping-missing",
          transaction,
          message: text("交易已确认，但赏金映射尚未找到。当前不能标记映射已验证。", "Transaction is confirmed, but the bounties mapping is not found yet. Mapping Verified cannot be marked."),
        });
        return;
      }
      if (!bountyResponse.ok || !bountyPayload.bounty) {
        setState({
          kind: "unavailable",
          message: bountyPayload.error ?? text("无法读取 Aleo 测试网赏金映射。", "Unable to read the Aleo Testnet bounties mapping."),
        });
        return;
      }

      setState({
        kind: "verified",
        transaction,
        bounty: bountyPayload.bounty,
        acceptance: verifyCreateBountyMapping(transaction, bountyPayload.bounty, wallet.address),
      });
    } catch {
      setState({ kind: "unavailable", message: text("公开测试网查询暂时不可用，请稍后重试。", "The public Testnet query is temporarily unavailable. Try again shortly.") });
    }
  }

  const confirmed = state.kind === "mapping-missing" || state.kind === "verified";
  const mappingVerified = state.kind === "verified" && state.acceptance.mappingVerified;

  return (
    <div className="grid gap-6">
      <section className="surface-card-strong rounded-lg p-6 sm:p-7">
        <p className="page-kicker">{text("测试网验收", "Testnet Acceptance")}</p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{text("create_bounty 链上验收", "create_bounty on-chain acceptance")}</h1>
        <p className="muted-copy mt-3 max-w-3xl">
          {text("钱包请求编号只表示钱包已接收请求。只有公开交易被确认且赏金映射与其输入一致，才标记链上创建完成。", "A Wallet Request ID means only that the Wallet received the request. Creation is marked complete only after the public transaction is confirmed and the bounties mapping matches its inputs.")}
        </p>
      </section>

      <section className="surface-card rounded-lg p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stage label={text("钱包已提交", "Wallet Submitted")} active={Boolean(wallet.submission) || confirmed} complete={confirmed} />
          <Stage label={text("交易已确认", "Transaction Confirmed")} active={confirmed} complete={confirmed} />
          <Stage label={text("映射已验证", "Mapping Verified")} active={mappingVerified} complete={mappingVerified} />
        </div>

        {wallet.submission ? (
          <div className="mt-5 grid gap-4 border-y border-white/10 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">
                {wallet.submission.publicTransactionId
                  ? text("钱包响应编号（已识别为公开交易编号）", "Wallet Response ID (recognized as a Public Transaction ID)")
                  : text("钱包请求编号（不是公开交易编号）", "Wallet Request ID (not a public Transaction ID)")}
              </p>
              <p className="mt-1 break-all font-mono text-sm text-cyan-100">{wallet.submission.walletRequestId}</p>
              <p className="mt-2 text-sm text-slate-400">{getLocalizedWalletMessage(wallet.submission.statusText, text)}</p>
            </div>
            <button className="focus-ring secondary-action" type="button" onClick={() => void wallet.refreshSubmission()}>
              <RefreshCw size={15} aria-hidden="true" />
              {text("刷新钱包状态", "Refresh Wallet status")}
            </button>
          </div>
        ) : (
          <p className="mt-5 border-y border-white/10 py-4 text-sm text-slate-400">
            {text("当前页面没有内存中的钱包请求。刷新页面后可直接使用公开交易编号恢复验收，不依赖本地存储。", "This page has no in-memory Wallet Request. After a refresh, use the public Transaction ID to restore acceptance without localStorage.")}
          </p>
        )}

        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={verifyPublicState}>
          <label className="grid gap-2 text-sm text-slate-300">
            {text("公开交易编号", "Public Transaction ID")}
            <input
              className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              placeholder="at1..."
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            {text("赏金编号", "Bounty ID")}
            <input
              className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
              value={bountyId}
              onChange={(event) => setBountyId(event.target.value)}
              placeholder="123field"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button className="focus-ring primary-action w-fit md:col-span-2" type="submit" disabled={state.kind === "loading"}>
            {state.kind === "loading" ? <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
            {state.kind === "loading" ? text("正在查询测试网", "Querying Testnet") : text("验证公开链上状态", "Verify public on-chain state")}
          </button>
        </form>
      </section>

      <VerificationOutput state={state} />
    </div>
  );
}

function VerificationOutput({ state }: { state: VerificationState }) {
  const { text } = useLocale();
  if (state.kind === "idle" || state.kind === "loading") return null;
  if (state.kind === "pending" || state.kind === "unavailable") {
    return <MessagePanel tone="warning" message={state.message} />;
  }
  if (state.kind === "mapping-missing") {
    return (
      <section className="surface-card rounded-lg border-amber-300/20 p-5 sm:p-6">
        <MessagePanelContent tone="warning" message={state.message} />
        <TransactionFacts transaction={state.transaction} />
      </section>
    );
  }

  const { transaction, bounty, acceptance } = state;
  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="page-kicker">{text("验收结果", "Acceptance Result")}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {acceptance.mappingVerified ? text("映射已验证", "Mapping Verified") : text("映射不匹配", "Mapping Mismatch")}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {text("所有者校验：", "Owner check: ")}{acceptance.ownerCheck === "Verified" ? text("与当前钱包一致", "Matches current wallet") : acceptance.ownerCheck === "Mismatch" ? text("与当前钱包不一致", "Does not match current wallet") : text("未连接钱包，尚未比对", "Wallet is not connected")}
          </p>
        </div>
        <StatusIcon ok={acceptance.mappingVerified} />
      </div>

      <TransactionFacts transaction={transaction} />
      <div className="mt-5 grid gap-x-6 border-t border-white/10 sm:grid-cols-2">
        {acceptance.checks.map((item) => (
          <div className="grid min-w-0 gap-2 border-b border-white/10 py-3" key={item.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{item.label}</p>
              <CheckBadge status={item.status} />
            </div>
            <p className="break-all font-mono text-xs text-slate-200">{item.actual}</p>
            {item.status === "Mismatch" ? (
              <p className="break-all text-xs text-red-200">{text("预期值", "Expected")}: {item.expected}</p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link className="focus-ring secondary-action" href={`/bounties/${encodeURIComponent(bounty.bountyId)}`}>
          {text("打开公开赏金", "Open public Bounty")}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <a className="focus-ring secondary-action" href={transaction.explorerUrl} target="_blank" rel="noreferrer">
          Provable Explorer
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

function Stage({ label, active, complete }: { label: string; active: boolean; complete: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${active ? "border-cyan-300/25 bg-cyan-300/[0.07]" : "border-white/10 bg-white/[0.025]"}`}>
      <div className="flex items-center gap-2">
        {complete ? <CheckCircle2 size={16} className="text-emerald-300" aria-hidden="true" /> : <CircleDashed size={16} className={active ? "text-cyan-200" : "text-slate-600"} aria-hidden="true" />}
        <p className={`text-sm font-semibold ${active ? "text-white" : "text-slate-500"}`}>{label}</p>
      </div>
    </div>
  );
}

function TransactionFacts({ transaction }: { transaction: ConfirmedCreateBountyTransaction }) {
  const { text } = useLocale();
  return (
    <dl className="mt-5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
      <Fact label={text("交易编号", "Transaction")} value={transaction.transactionId} />
      <Fact label={text("区块高度", "Block Height")} value={String(transaction.blockHeight)} />
      <Fact label={text("赏金编号", "Bounty ID")} value={transaction.publicInputs.bountyId} />
      <Fact label={text("范围哈希", "Scope Hash")} value={transaction.publicInputs.scopeHash} />
      <Fact label={text("规则编号", "Rule ID")} value={transaction.publicInputs.ruleId} />
      <Fact label={text("数据来源", "Data Source")} value="Aleo Testnet" />
    </dl>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 border-b border-white/10 py-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-all font-mono text-xs text-slate-200">{value}</dd></div>;
}

function CheckBadge({ status }: { status: "Verified" | "Mismatch" | "NotChecked" }) {
  const { text } = useLocale();
  const className = status === "Verified" ? "text-emerald-200" : status === "Mismatch" ? "text-red-200" : "text-amber-200";
  const label = status === "Verified" ? text("已验证", "Verified") : status === "Mismatch" ? text("不匹配", "Mismatch") : text("未检查", "Not checked");
  return <span className={`text-xs font-semibold ${className}`}>{label}</span>;
}

function StatusIcon({ ok }: { ok: boolean }) {
  const { text } = useLocale();
  return ok ? <CheckCircle2 className="text-emerald-300" size={26} aria-label={text("已验证", "Verified")} /> : <XCircle className="text-red-300" size={26} aria-label={text("不匹配", "Mismatch")} />;
}

function MessagePanel({ tone, message }: { tone: "warning"; message: string }) {
  return <section className="surface-card rounded-lg border-amber-300/20 p-5 sm:p-6"><MessagePanelContent tone={tone} message={message} /></section>;
}

function MessagePanelContent({ message }: { tone: "warning"; message: string }) {
  return <p className="flex items-start gap-2 text-sm leading-6 text-amber-100" role="status"><CircleAlert className="mt-1 shrink-0" size={16} aria-hidden="true" />{message}</p>;
}
