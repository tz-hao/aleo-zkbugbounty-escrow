"use client";

import { Database, LoaderCircle, RefreshCw, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAleoWallet } from "@/components/aleo-wallet-provider";
import { useLocale } from "@/components/locale-provider";
import type {
  OnChainBountyEscrowState,
  OnChainBountyState,
  OnChainClaimPayoutState,
  OnChainClaimReceipt,
  OnChainClaimTriageState,
} from "@/lib/models";
import {
  buildAttestEncryptedDetailsTransaction,
  buildFundBountyTransaction,
  buildLockRewardTransaction,
  buildMarkPatchedTransaction,
  buildRefundBountyTransaction,
  buildRejectClaimTransaction,
  buildReleaseRewardTransaction,
  buildRequestDisclosureTransaction,
  REWARD_ESCROW_CAPABILITY,
  rewardForSeverity,
  type RewardEscrowCapability,
  type RewardEscrowTransactionPreview,
} from "@/lib/aleo-reward-escrow";
import { ALEO_TESTNET_PROGRAM_OWNER } from "@/lib/aleo-program";
import { getLocalizedTransactionMessage } from "@/lib/i18n/transaction";
import { getLocalizedWalletMessage } from "@/lib/i18n/wallet";

type ChainBundle = {
  bounty: OnChainBountyState;
  receipt: OnChainClaimReceipt;
  reporterAddress: string | null;
  escrow: OnChainBountyEscrowState | null;
  payout: OnChainClaimPayoutState | null;
  triage: OnChainClaimTriageState | null;
};

type BountyEscrowBundle = {
  bounty: OnChainBountyState;
  escrow: OnChainBountyEscrowState | null;
  protocolVersion: number;
  unresolvedClaimCount: string | null;
  currentHeight: number | null;
};

type ActionName =
  | "fund"
  | "lock"
  | "request"
  | "share"
  | "patch"
  | "release"
  | "reject"
  | "refund";

function getChineseCapabilityStatus(status: RewardEscrowCapability["status"]) {
  if (status === "Available") return "可用";
  if (status === "ProgramUpgradeRequired") return "需要程序升级";
  if (status === "ConfigurationError") return "配置错误";
  return "暂不可用";
}

function getChineseBountyStatus(status: OnChainBountyState["status"]) {
  if (status === "Active") return "进行中";
  if (status === "Paused") return "已暂停";
  return "已关闭";
}

function getChineseTriageStatus(status?: OnChainClaimTriageState["status"]) {
  if (!status) return "尚未开始";
  const labels: Record<OnChainClaimTriageState["status"], string> = {
    RewardLocked: "奖励已锁定",
    DetailsRequested: "已请求加密细节",
    EncryptedDetailsShared: "已分享加密细节",
    Patched: "已修复",
    Paid: "已支付",
    Rejected: "已拒绝",
  };
  return labels[status];
}

function getChinesePayoutStatus(status?: OnChainClaimPayoutState["status"]) {
  if (!status) return "尚未充值";
  if (status === "RewardLocked") return "奖励已锁定";
  if (status === "Paid") return "已支付";
  return "已拒绝";
}
function randomPublicField() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) + BigInt(byte);
  return `${value || 1n}field`;
}

async function readJson<T>(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as T | { error?: string } | null;
  return { response, payload };
}

function readNetworkHeight(result: {
  response: Response;
  payload: { network?: { latestHeight?: number } } | { error?: string } | null;
}) {
  if (!result.response.ok || !result.payload || !("network" in result.payload)) {
    return null;
  }
  const latestHeight = result.payload.network?.latestHeight;
  return typeof latestHeight === "number" && Number.isSafeInteger(latestHeight)
    ? latestHeight
    : null;
}

export function OnChainTriageWorkspace() {
  const { text } = useLocale();
  const routeClaimHash = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("claimHash")?.trim() ?? "";
  const loadedRouteClaimHash = useRef<string | null>(null);
  const {
    address,
    connectionState,
    connect,
    protocolSubmission,
    transactionStatus,
    transactionSubmissionBlocked,
    submitProtocolTransaction,
  } = useAleoWallet();
  const [capability, setCapability] = useState<RewardEscrowCapability>(
    REWARD_ESCROW_CAPABILITY,
  );
  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [claimHash, setClaimHash] = useState("");
  const [bountyId, setBountyId] = useState("");
  const [bundle, setBundle] = useState<ChainBundle | null>(null);
  const [bountyBundle, setBountyBundle] = useState<BountyEscrowBundle | null>(null);
  const [amount, setAmount] = useState("");
  const [packageHash, setPackageHash] = useState("");
  const [fee, setFee] = useState("1000000");
  const [pendingPreview, setPendingPreview] =
    useState<RewardEscrowTransactionPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/aleo/escrow", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { escrow?: RewardEscrowCapability };
        if (payload.escrow) setCapability(payload.escrow);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCapability({ ...REWARD_ESCROW_CAPABILITY, status: "EndpointUnavailable" });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCapabilityChecked(true);
      });
    return () => controller.abort();
  }, []);

  const isOwner = Boolean(bundle && address && bundle.bounty.owner === address);
  const isReporter = Boolean(bundle?.reporterAddress && address === bundle.reporterAddress);
  const isArbiter = address === ALEO_TESTNET_PROGRAM_OWNER;
  const availableActions = useMemo<ActionName[]>(() => {
    if (
      !bundle ||
      bundle.receipt.protocolVersion !== 2 ||
      capability.status !== "Available"
    ) {
      return [];
    }
    const actions: ActionName[] = [];
    let escrowCanCoverReward = false;
    try {
      escrowCanCoverReward = Boolean(
        bundle.escrow &&
          BigInt(bundle.escrow.availableBalance) >=
            BigInt(rewardForSeverity(bundle.bounty, bundle.receipt.severity)),
      );
    } catch {
      escrowCanCoverReward = false;
    }
    if (
      isOwner &&
      bundle.reporterAddress &&
      escrowCanCoverReward &&
      !bundle.payout &&
      !bundle.triage
    ) {
      actions.push("lock");
    }
    const payoutLocked = bundle.payout?.status === "RewardLocked";
    if (isOwner && payoutLocked && bundle.triage?.status === "RewardLocked") {
      actions.push("request");
    }
    if (isReporter && payoutLocked && bundle.triage?.status === "DetailsRequested") {
      actions.push("share");
    }
    if (isOwner && payoutLocked && bundle.triage?.status === "EncryptedDetailsShared") {
      actions.push("patch");
    }
    if (isOwner && payoutLocked && bundle.triage?.status === "Patched") {
      actions.push("release");
    }
    if (
      isArbiter &&
      (!bundle.triage ||
        bundle.triage.status === "RewardLocked" ||
        bundle.triage.status === "DetailsRequested")
    ) {
      actions.push("reject");
    }
    return actions;
  }, [bundle, capability.status, isArbiter, isOwner, isReporter]);
  const availableBountyActions = useMemo<ActionName[]>(() => {
    if (
      !bountyBundle ||
      bountyBundle.protocolVersion !== 2 ||
      capability.status !== "Available" ||
      !address ||
      bountyBundle.bounty.owner !== address
    ) {
      return [];
    }
    const actions: ActionName[] = [];
    if (bountyBundle.currentHeight === null) return actions;
    if (
      bountyBundle.bounty.status !== "Closed" &&
      bountyBundle.currentHeight <= bountyBundle.bounty.disclosureDeadline
    ) {
      actions.push("fund");
    }
    if (
      bountyBundle.bounty.status === "Closed" &&
      bountyBundle.currentHeight > bountyBundle.bounty.disclosureDeadline &&
      bountyBundle.escrow &&
      bountyBundle.escrow.lockedAmount === "0" &&
      bountyBundle.unresolvedClaimCount === "0" &&
      BigInt(bountyBundle.escrow.availableBalance) > 0n
    ) {
      actions.push("refund");
    }
    return actions;
  }, [address, bountyBundle, capability.status]);

  async function lookupBounty() {
    const key = bountyId.trim();
    if (!/^[0-9]+field$/.test(key)) {
      setMessage(text("请输入有效的 Aleo 赏金编号。", "Enter a valid Aleo Bounty ID."));
      return;
    }
    if (capability.status !== "Available") {
      setMessage(text("当前部署尚未启用链上托管与分诊。", "On-chain Escrow/Triage is not enabled by the current deployment."));
      return;
    }
    setBusy(true);
    setMessage(null);
    setBountyBundle(null);
    setPendingPreview(null);
    try {
      const [bountyResult, escrowResult, networkResult] = await Promise.all([
        readJson<{ bounty: OnChainBountyState }>(
          `/api/aleo/bounties/${encodeURIComponent(key)}`,
        ),
        readJson<{
          escrow: OnChainBountyEscrowState | null;
          protocolVersion: number;
          unresolvedClaimCount: string | null;
        }>(`/api/aleo/escrow/${encodeURIComponent(key)}`),
        readJson<{ network?: { latestHeight?: number } }>("/api/aleo/network"),
      ]);
      if (!bountyResult.response.ok || !("bounty" in (bountyResult.payload ?? {}))) {
        throw new Error(text("未找到链上赏金映射。", "On-chain Bounty Mapping was not found."));
      }
      if (
        !escrowResult.response.ok ||
        !("protocolVersion" in (escrowResult.payload ?? {}))
      ) {
        throw new Error(text("该赏金不具备协议 v2 托管资格。", "This Bounty is not eligible for protocol-v2 Escrow."));
      }
      const bounty = (bountyResult.payload as { bounty: OnChainBountyState }).bounty;
      const escrowState = escrowResult.payload as {
        escrow: OnChainBountyEscrowState | null;
        protocolVersion: number;
        unresolvedClaimCount: string | null;
      };
      setBountyBundle({
        bounty,
        ...escrowState,
        currentHeight: readNetworkHeight(networkResult),
      });
      setAmount(escrowState.escrow?.availableBalance ?? "");
      setMessage(text("赏金托管公开状态已读取。", "Public Bounty Escrow state was read."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("赏金托管状态读取失败。", "Bounty Escrow lookup failed."));
    } finally {
      setBusy(false);
    }
  }

  const lookupClaim = useCallback(async (value: string) => {
    const key = value.trim();
    if (!/^[0-9]+field$/.test(key)) {
      setMessage(text("请输入有效的 Aleo 漏洞声明哈希。", "Enter a valid Aleo Claim Hash."));
      return;
    }
    if (capability.status !== "Available") {
      setMessage(text("当前部署尚未启用链上托管与分诊。", "On-chain Escrow/Triage is not enabled by the current deployment."));
      return;
    }
    setBusy(true);
    setMessage(null);
    setBundle(null);
    setPendingPreview(null);
    try {
      const receiptResult = await readJson<{ receipt: OnChainClaimReceipt }>(
        `/api/aleo/receipts/${encodeURIComponent(key)}`,
      );
      if (!receiptResult.response.ok || !("receipt" in (receiptResult.payload ?? {}))) {
        throw new Error(text("未找到链上漏洞声明收据。", "On-chain Claim Receipt was not found."));
      }
      const receipt = (receiptResult.payload as { receipt: OnChainClaimReceipt }).receipt;
      const [bountyResult, triageResult, escrowResult, networkResult] = await Promise.all([
        readJson<{ bounty: OnChainBountyState }>(
          `/api/aleo/bounties/${encodeURIComponent(receipt.bountyId)}`,
        ),
        readJson<{
          payout: OnChainClaimPayoutState | null;
          triage: OnChainClaimTriageState | null;
          reporterAddress: string | null;
        }>(`/api/aleo/triage/${encodeURIComponent(key)}`),
        readJson<{
          escrow: OnChainBountyEscrowState | null;
          protocolVersion: number;
          unresolvedClaimCount: string | null;
        }>(
          `/api/aleo/escrow/${encodeURIComponent(receipt.bountyId)}`,
        ),
        readJson<{ network?: { latestHeight?: number } }>("/api/aleo/network"),
      ]);
      if (!bountyResult.response.ok || !("bounty" in (bountyResult.payload ?? {}))) {
        throw new Error(text("漏洞声明对应的赏金映射不可用。", "The Bounty Mapping for this Claim is unavailable."));
      }
      const bounty = (bountyResult.payload as { bounty: OnChainBountyState }).bounty;
      const triagePayload = triageResult.response.ok
        ? triageResult.payload as {
            payout: OnChainClaimPayoutState | null;
            triage: OnChainClaimTriageState | null;
            reporterAddress: string | null;
          }
        : { payout: null, triage: null, reporterAddress: null };
      const escrowPayload = escrowResult.response.ok
        ? escrowResult.payload as {
            escrow: OnChainBountyEscrowState | null;
            protocolVersion: number;
            unresolvedClaimCount: string | null;
          }
        : null;
      const escrow = escrowPayload?.escrow ?? null;
      setBundle({
        bounty,
        receipt,
        reporterAddress: triagePayload.reporterAddress,
        escrow,
        payout: triagePayload.payout,
        triage: triagePayload.triage,
      });
      setBountyId(bounty.bountyId);
      if (escrowPayload) {
        setBountyBundle({
          bounty,
          ...escrowPayload,
          currentHeight: readNetworkHeight(networkResult),
        });
      }
      setAmount(escrow?.availableBalance ?? "");
      setMessage(text("链上公开状态已读取。操作仍需钱包签名与映射验证。", "Public on-chain state was read. The action still requires a wallet signature and Mapping verification."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("链上状态读取失败。", "On-chain state lookup failed."));
    } finally {
      setBusy(false);
    }
  }, [capability.status, text]);

  useEffect(() => {
    if (
      !capabilityChecked ||
      capability.status !== "Available" ||
      !/^[0-9]+field$/.test(routeClaimHash) ||
      loadedRouteClaimHash.current === routeClaimHash
    ) {
      return;
    }
    loadedRouteClaimHash.current = routeClaimHash;
    void lookupClaim(routeClaimHash);
  }, [capability.status, capabilityChecked, lookupClaim, routeClaimHash]);
  function buildActionPreview(action: ActionName): RewardEscrowTransactionPreview {
    const feeMicrocredits = Number(fee);
    if (action === "fund") {
      if (!bountyBundle) throw new Error(text("请先读取赏金。", "Read the Bounty first."));
      return buildFundBountyTransaction({
        bountyId: bountyBundle.bounty.bountyId,
        amount,
        fundingMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (action === "refund") {
      if (!bountyBundle) throw new Error(text("请先读取赏金。", "Read the Bounty first."));
      return buildRefundBountyTransaction({
        bountyId: bountyBundle.bounty.bountyId,
        amount: bountyBundle.escrow?.availableBalance ?? "",
        refundMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (!bundle) throw new Error(text("请先读取漏洞声明。", "Read the Claim first."));
    if (action === "lock") {
      return buildLockRewardTransaction({
        bounty: bundle.bounty,
        receipt: bundle.receipt,
        whitehatAddress: bundle.reporterAddress ?? "",
        lockMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (action === "request") {
      return buildRequestDisclosureTransaction({
        bountyId: bundle.bounty.bountyId,
        claimHash: bundle.receipt.claimHash,
        requestMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (action === "share") {
      return buildAttestEncryptedDetailsTransaction({
        bountyId: bundle.bounty.bountyId,
        claimHash: bundle.receipt.claimHash,
        packageHash,
        shareMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (action === "patch") {
      return buildMarkPatchedTransaction({
        bountyId: bundle.bounty.bountyId,
        claimHash: bundle.receipt.claimHash,
        patchedMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (action === "release") {
      return buildReleaseRewardTransaction({
        bounty: bundle.bounty,
        receipt: bundle.receipt,
        whitehatAddress: bundle.payout?.whitehatAddress ?? "",
        releaseMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (action === "reject") {
      return buildRejectClaimTransaction({
        bountyId: bundle.bounty.bountyId,
        claimHash: bundle.receipt.claimHash,
        rejectionMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    throw new Error("Unsupported protocol action");
  }

  function prepareAction(action: ActionName) {
    setMessage(null);
    try {
      setPendingPreview(buildActionPreview(action));
      setMessage(
        text(
          "交易预览已生成。核对公开输入后再请求钱包签名。",
          "Transaction preview is ready. Review public inputs before requesting a wallet signature.",
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "交易未能完成。");
    }
  }

  async function requestPreparedAction() {
    if (!pendingPreview) return;
    if (connectionState !== "Connected") {
      await connect();
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await submitProtocolTransaction(pendingPreview);
      setPendingPreview(null);
      setMessage(text("钱包请求已创建；这不是已确认交易，也不会提前更新链上映射。", "The Wallet Request was created. It is not a Confirmed Transaction and does not update Mapping state early."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("钱包请求失败。", "Wallet request failed."));
    } finally {
      setBusy(false);
    }
  }

  const actionLabels: Record<ActionName, string> = {
    fund: text("充值托管", "Fund Escrow"),
    lock: text("受理并锁定奖励（V2）", "Accept + lock reward (V2)"),
    request: text("请求加密细节", "Request encrypted details"),
    share: text("登记密文包哈希", "Record Package Hash"),
    patch: text("项目方声明已修复（V2）", "Owner attests patch (V2)"),
    release: text("项目方释放奖励（V2）", "Owner releases reward (V2)"),
    reject: text("固定管理员拒绝声明（V2）", "Fixed admin rejects Claim (V2)"),
    refund: text("退回可用余额", "Refund available balance"),
  };

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-labelledby="chain-triage-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">{text("Aleo 测试网注册表", "Aleo Testnet Registry")}</p>
          <h2 id="chain-triage-title" className="mt-2 text-lg font-semibold text-white">
            {text("链上分诊", "On-chain Triage")}
          </h2>
        </div>
        <span className="font-mono text-xs text-slate-500">
          {capabilityChecked ? text(getChineseCapabilityStatus(capability.status), capability.status) : text("核验中", "Checking")}
        </span>
      </div>

      {!capabilityChecked ? (
        <div className="mt-5 border-l-2 border-cyan-300/40 pl-4 text-sm leading-6 text-slate-400">
          {text(
            "正在从公开程序源码与当前版本核验链上分诊能力；钱包操作保持禁用。",
            "Verifying on-chain triage capability from the public Program source and current edition. Wallet actions stay disabled.",
          )}
        </div>
      ) : capability.status !== "Available" ? (
        <div className="mt-5 border-l-2 border-amber-300/40 pl-4 text-sm leading-6 text-slate-400">
          {capability.status === "ProgramUpgradeRequired"
            ? text("当前程序尚未启用托管与分诊映射。链上赏金、收据和防重复标识读取不受影响。", "The current Program has not enabled Escrow and Triage mappings. On-chain Bounty, Receipt, and Nullifier reads are unaffected.")
            : text("暂时无法核验链上能力；不会启用钱包操作，也不会使用本地状态替代。", "On-chain capability cannot be verified right now. Wallet actions remain disabled and there is no local-state substitute.")}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 border-b border-white/10 pb-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="grid gap-2 text-sm text-slate-300">
                {text("赏金编号", "Bounty ID")}
                <input
                  className="focus-ring min-h-11 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white"
                  value={bountyId}
                  onChange={(event) => setBountyId(event.target.value)}
                  placeholder="123...field"
                />
              </label>
              <button
                className="secondary-action self-end"
                type="button"
                disabled={busy}
                onClick={lookupBounty}
              >
                {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Database size={16} />}
                {text("读取托管状态", "Read Escrow")}
              </button>
            </div>
            {bountyBundle ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ChainField label={text("协议版本", "Protocol")} value={`v${bountyBundle.protocolVersion}`} />
                <ChainField label={text("赏金状态", "Bounty")} value={text(getChineseBountyStatus(bountyBundle.bounty.status), bountyBundle.bounty.status)} />
                <ChainField
                  label={text("可用余额", "Available")}
                  value={bountyBundle.escrow?.availableBalance ?? "0"}
                />
                <ChainField
                  label={text("未结案声明", "Unresolved Claims")}
                  value={bountyBundle.unresolvedClaimCount ?? "0"}
                />
                <ChainField
                  label={text("测试网高度", "Testnet Height")}
                  value={bountyBundle.currentHeight?.toLocaleString() ?? text("暂不可用", "Unavailable")}
                />
              </div>
            ) : null}
            {bountyBundle && availableBountyActions.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <CompactInput
                  label={text("金额（microcredits）", "Amount (microcredits)")}
                  value={amount}
                  onChange={setAmount}
                  placeholder="1000000"
                />
                <CompactInput
                  label={text("交易费（microcredits）", "Fee (microcredits)")}
                  value={fee}
                  onChange={setFee}
                  placeholder="1000000"
                />
                <div className="flex flex-wrap gap-2">
                  {availableBountyActions.map((action) => (
                    <button
                      className="secondary-action"
                      type="button"
                      key={action}
                      disabled={busy || transactionSubmissionBlocked}
                      onClick={() => prepareAction(action)}
                    >
                      {actionLabels[action]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {bountyBundle && connectionState !== "Connected" ? (
              <button
                className="primary-action w-fit"
                type="button"
                onClick={() => void connect()}
              >
                <WalletCards size={16} />
                {text("连接 Shield", "Connect Shield")}
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-sm text-slate-300">
              漏洞声明哈希
              <input
                className="focus-ring min-h-11 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white"
                value={routeClaimHash || claimHash}
                onChange={(event) => setClaimHash(event.target.value)}
                placeholder="123...field"
              />
            </label>
            <button
              className="secondary-action self-end"
              type="button"
              disabled={busy}
              onClick={() => void lookupClaim(routeClaimHash || claimHash)}
            >
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Database size={16} />}
              {text("读取链上映射", "Read Mapping")}
            </button>
          </div>

          {bundle ? (
            <div className="mt-5 grid gap-5">
              <div className="grid gap-3 border-y border-white/10 py-4 sm:grid-cols-2 lg:grid-cols-4">
                <ChainField label={text("赏金", "Bounty")} value={bundle.bounty.bountyId} />
                <ChainField
                  label={text("协议版本", "Protocol")}
                  value={`v${bundle.receipt.protocolVersion}`}
                />
                <ChainField label={text("分诊状态", "Triage")} value={text(getChineseTriageStatus(bundle.triage?.status), bundle.triage?.status ?? "NotStarted")} />
                <ChainField label={text("支付状态", "Payout")} value={text(getChinesePayoutStatus(bundle.payout?.status), bundle.payout?.status ?? "Unfunded")} />
                <ChainField
                  label={text("托管可用余额", "Escrow Available")}
                  value={bundle.escrow ? `${bundle.escrow.availableBalance} microcredits` : text("尚未充值", "NotFunded")}
                />
              </div>

              {bundle.receipt.protocolVersion === 2 ? (
                <p className="border-l-2 border-amber-300/40 pl-4 text-sm leading-6 text-slate-400">
                  {text("当前 Testnet 的 V2 只把公开收据作为锁款门槛；“修复”和“放款”仍是项目方单方链上声明，不等于加密报告已收到、漏洞已复现或独立仲裁已完成。", "Current Testnet V2 uses the public Receipt only as a reward-lock threshold. Its patch and payout events are unilateral Owner attestations, not proof of received disclosure, reproduced vulnerability, or independent arbitration.")}
                </p>
              ) : null}

              {bundle.receipt.protocolVersion !== 2 ? (
                <p className="border-l-2 border-amber-300/40 pl-4 text-sm leading-6 text-slate-400">
                  {text("该收据属于协议 v1，仅支持公开验证，不具备托管支付资格。", "This Receipt belongs to protocol v1. It supports public verification only and is not eligible for Escrow payout.")}
                </p>
              ) : null}
              {bundle.receipt.protocolVersion === 2 && !bundle.reporterAddress ? (
                <p className="border-l-2 border-rose-300/40 pl-4 text-sm leading-6 text-slate-400">
                  {text("未找到 claim_reporters 映射，无法安全锁定奖励；不会允许手填收款地址。", "claim_reporters Mapping was not found, so the reward cannot be locked safely. Manual recipient entry is not allowed.")}
                </p>
              ) : null}
              {bundle.receipt.protocolVersion === 2 &&
              bundle.reporterAddress &&
              isOwner &&
              !bundle.payout &&
              !bundle.triage &&
              !availableActions.includes("lock") ? (
                <p className="border-l-2 border-amber-300/40 pl-4 text-sm leading-6 text-slate-400">
                  {text("托管可用余额不足以覆盖该严重程度奖励，请先在上方为赏金充值。", "Available Escrow balance cannot cover this Severity reward. Fund the Bounty above first.")}
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                {availableActions.includes("lock") ? (
                  <ChainField
                    label={text("白帽研究员（claim_reporters）", "Whitehat (claim_reporters)")}
                    value={bundle.reporterAddress ?? text("映射不可用", "Mapping unavailable")}
                  />
                ) : null}
                {availableActions.includes("share") ? (
                  <CompactInput
                    label={text("密文包哈希", "Package Hash")}
                    value={packageHash}
                    onChange={setPackageHash}
                    placeholder="123...field"
                  />
                ) : null}
                <CompactInput
                  label={text("交易费（microcredits）", "Fee (microcredits)")}
                  value={fee}
                  onChange={setFee}
                  placeholder="1000000"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {connectionState !== "Connected" ? (
                  <button className="primary-action" type="button" onClick={() => void connect()}>
                    <WalletCards size={16} />
                    {text("连接 Shield", "Connect Shield")}
                  </button>
                ) : null}
                {availableActions.map((action) => (
                  <button
                    className={action === "release" ? "primary-action" : "secondary-action"}
                    type="button"
                    key={action}
                    disabled={busy || transactionSubmissionBlocked}
                    onClick={() => prepareAction(action)}
                  >
                    {actionLabels[action]}
                  </button>
                ))}
                <button className="icon-action" type="button" onClick={() => void lookupClaim(routeClaimHash || claimHash)} title={text("刷新链上映射", "Refresh Mapping")}>
                  <RefreshCw size={16} />
                  <span className="sr-only">{text("刷新链上映射", "Refresh Mapping")}</span>
                </button>
              </div>

            </div>
          ) : null}

          {pendingPreview ? (
            <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ChainField label={text("程序", "Program")} value={pendingPreview.programId} />
                <ChainField label={text("函数", "Function")} value={pendingPreview.functionName} />
                <ChainField label={text("网络", "Network")} value={text("Aleo 测试网", pendingPreview.network)} />
                <ChainField
                  label={text("交易费", "Fee")}
                  value={`${pendingPreview.feeMicrocredits} microcredits`}
                />
              </div>
              <ChainField
                label={text("操作标识", "Operation Marker")}
                value={pendingPreview.publicSummary.operationMarker ?? text("暂不可用", "Unavailable")}
              />
              <details className="mt-3 border-t border-white/10 pt-3">
                <summary className="focus-ring cursor-pointer text-xs font-semibold text-slate-400">
                  {text("查看公开输入", "View public inputs")}
                </summary>
                <ol className="mt-3 grid gap-2 font-mono text-xs text-slate-400">
                  {pendingPreview.inputs.map((input, index) => (
                    <li className="break-all" key={`${index}-${input}`}>
                      {index + 1}. {input}
                    </li>
                  ))}
                </ol>
              </details>
              <p className="mt-4 text-xs leading-5 text-amber-100/80">
                {text("交易待处理期间请勿重复提交同一操作。", "Do not resubmit the same operation while the transaction is pending.")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="primary-action"
                  type="button"
                  disabled={busy || transactionSubmissionBlocked}
                  onClick={() => void requestPreparedAction()}
                >
                  <WalletCards size={16} />
                  {text("请求钱包签名", "Request Wallet signature")}
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={busy}
                  onClick={() => setPendingPreview(null)}
                >
                  {text("取消", "Cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {message ? <p className="mt-4 text-sm leading-6 text-slate-400">{message}</p> : null}
      {protocolSubmission ? (
        <div className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-slate-500">
          <span className="text-slate-300">{protocolSubmission.functionName}</span>
          {" · "}
          {text("钱包请求", "Wallet Request")}: <span className="font-mono">{protocolSubmission.walletRequestId}</span>
          {" · "}
          {getLocalizedWalletMessage(protocolSubmission.statusText, text)}
          <span className="block text-amber-100/80">{getLocalizedTransactionMessage(transactionStatus.state, text)}</span>
        </div>
      ) : null}
    </section>
  );
}

function ChainField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-sm text-slate-200">{value}</p>
    </div>
  );
}

function CompactInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 text-xs text-slate-400">
      {label}
      <input
        className="focus-ring min-h-11 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
