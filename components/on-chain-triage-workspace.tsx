"use client";

import { Database, LoaderCircle, RefreshCw, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAleoWallet } from "@/components/aleo-wallet-provider";
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
      setMessage("请输入有效的 Aleo Bounty ID。");
      return;
    }
    if (capability.status !== "Available") {
      setMessage("当前部署尚未启用链上 Escrow/Triage。");
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
        throw new Error("未找到链上 Bounty Mapping。");
      }
      if (
        !escrowResult.response.ok ||
        !("protocolVersion" in (escrowResult.payload ?? {}))
      ) {
        throw new Error("该 Bounty 不具备 protocol-v2 Escrow 资格。");
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
      setMessage("Bounty Escrow 公开状态已读取。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bounty Escrow 读取失败。");
    } finally {
      setBusy(false);
    }
  }

  async function lookup() {
    const key = claimHash.trim();
    if (!/^[0-9]+field$/.test(key)) {
      setMessage("请输入有效的 Aleo Claim Hash。");
      return;
    }
    if (capability.status !== "Available") {
      setMessage("当前部署尚未启用链上 Escrow/Triage。");
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
        throw new Error("未找到链上 Claim Receipt。");
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
        throw new Error("Claim 对应的 Bounty Mapping 不可用。");
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
      setMessage("链上公开状态已读取。操作仍需 Wallet 签名与 Mapping 验证。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "链上状态读取失败。");
    } finally {
      setBusy(false);
    }
  }

  function buildActionPreview(action: ActionName): RewardEscrowTransactionPreview {
    const feeMicrocredits = Number(fee);
    if (action === "fund") {
      if (!bountyBundle) throw new Error("请先读取 Bounty。");
      return buildFundBountyTransaction({
        bountyId: bountyBundle.bounty.bountyId,
        amount,
        fundingMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (action === "refund") {
      if (!bountyBundle) throw new Error("请先读取 Bounty。");
      return buildRefundBountyTransaction({
        bountyId: bountyBundle.bounty.bountyId,
        amount: bountyBundle.escrow?.availableBalance ?? "",
        refundMarker: randomPublicField(),
        feeMicrocredits,
      });
    }
    if (!bundle) throw new Error("请先读取 Claim。");
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
      setMessage("Transaction Preview 已生成。核对公开输入后再请求 Wallet 签名。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transaction could not be completed.");
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
      setMessage("Wallet Request 已创建；这不是 Confirmed Transaction，也不会提前更新 Mapping。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet 请求失败。");
    } finally {
      setBusy(false);
    }
  }

  const actionLabels: Record<ActionName, string> = {
    fund: "充值 Escrow",
    lock: "锁定奖励",
    request: "请求加密细节",
    share: "登记 Package Hash",
    patch: "标记已修复",
    release: "释放奖励",
    reject: "Arbiter 拒绝 Claim",
    refund: "退回可用余额",
  };

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-labelledby="chain-triage-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Aleo Testnet Registry</p>
          <h2 id="chain-triage-title" className="mt-2 text-lg font-semibold text-white">
            链上 Triage
          </h2>
        </div>
        <span className="font-mono text-xs text-slate-500">
          {capabilityChecked ? capability.status : "Checking"}
        </span>
      </div>

      {!capabilityChecked ? (
        <div className="mt-5 border-l-2 border-cyan-300/40 pl-4 text-sm leading-6 text-slate-400">
          正在从公开 Program source 与 current edition 核验链上 Triage 能力；Wallet Action 保持禁用。
        </div>
      ) : capability.status !== "Available" ? (
        <div className="mt-5 border-l-2 border-amber-300/40 pl-4 text-sm leading-6 text-slate-400">
          {capability.status === "ProgramUpgradeRequired"
            ? "当前 Program 尚未启用 Escrow 与 Triage Mapping。链上 Bounty、Receipt 和 Nullifier 读取不受影响。"
            : "暂时无法核验链上能力；不会启用 Wallet Action，也不会使用本地状态替代。"}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 border-b border-white/10 pb-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="grid gap-2 text-sm text-slate-300">
                Bounty ID
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
                读取 Escrow
              </button>
            </div>
            {bountyBundle ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ChainField label="Protocol" value={`v${bountyBundle.protocolVersion}`} />
                <ChainField label="Bounty" value={bountyBundle.bounty.status} />
                <ChainField
                  label="Available"
                  value={bountyBundle.escrow?.availableBalance ?? "0"}
                />
                <ChainField
                  label="Unresolved Claims"
                  value={bountyBundle.unresolvedClaimCount ?? "0"}
                />
                <ChainField
                  label="Testnet Height"
                  value={bountyBundle.currentHeight?.toLocaleString() ?? "Unavailable"}
                />
              </div>
            ) : null}
            {bountyBundle && availableBountyActions.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <CompactInput
                  label="Amount (microcredits)"
                  value={amount}
                  onChange={setAmount}
                  placeholder="1000000"
                />
                <CompactInput
                  label="Fee (microcredits)"
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
                连接 Leo Wallet
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-sm text-slate-300">
              Claim Hash
              <input
                className="focus-ring min-h-11 rounded-md border border-white/10 bg-black/30 px-3 font-mono text-sm text-white"
                value={claimHash}
                onChange={(event) => setClaimHash(event.target.value)}
                placeholder="123...field"
              />
            </label>
            <button
              className="secondary-action self-end"
              type="button"
              disabled={busy}
              onClick={lookup}
            >
              {busy ? <LoaderCircle className="animate-spin" size={16} /> : <Database size={16} />}
              读取 Mapping
            </button>
          </div>

          {bundle ? (
            <div className="mt-5 grid gap-5">
              <div className="grid gap-3 border-y border-white/10 py-4 sm:grid-cols-2 lg:grid-cols-4">
                <ChainField label="Bounty" value={bundle.bounty.bountyId} />
                <ChainField
                  label="Protocol"
                  value={`v${bundle.receipt.protocolVersion}`}
                />
                <ChainField label="Triage" value={bundle.triage?.status ?? "NotStarted"} />
                <ChainField label="Payout" value={bundle.payout?.status ?? "Unfunded"} />
                <ChainField
                  label="Escrow Available"
                  value={bundle.escrow ? `${bundle.escrow.availableBalance} microcredits` : "NotFunded"}
                />
              </div>

              {bundle.receipt.protocolVersion !== 2 ? (
                <p className="border-l-2 border-amber-300/40 pl-4 text-sm leading-6 text-slate-400">
                  该 Receipt 属于 protocol v1，仅支持公开验证，不具备 Escrow 支付资格。
                </p>
              ) : null}
              {bundle.receipt.protocolVersion === 2 && !bundle.reporterAddress ? (
                <p className="border-l-2 border-rose-300/40 pl-4 text-sm leading-6 text-slate-400">
                  未找到 claim_reporters Mapping，无法安全锁定奖励；不会允许手填收款地址。
                </p>
              ) : null}
              {bundle.receipt.protocolVersion === 2 &&
              bundle.reporterAddress &&
              isOwner &&
              !bundle.payout &&
              !bundle.triage &&
              !availableActions.includes("lock") ? (
                <p className="border-l-2 border-amber-300/40 pl-4 text-sm leading-6 text-slate-400">
                  Escrow 可用余额不足以覆盖该 Severity 奖励，请先在上方为 Bounty 充值。
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                {availableActions.includes("lock") ? (
                  <ChainField
                    label="Whitehat（claim_reporters）"
                    value={bundle.reporterAddress ?? "Mapping unavailable"}
                  />
                ) : null}
                {availableActions.includes("share") ? (
                  <CompactInput
                    label="Package Hash"
                    value={packageHash}
                    onChange={setPackageHash}
                    placeholder="123...field"
                  />
                ) : null}
                <CompactInput
                  label="Fee (microcredits)"
                  value={fee}
                  onChange={setFee}
                  placeholder="1000000"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {connectionState !== "Connected" ? (
                  <button className="primary-action" type="button" onClick={() => void connect()}>
                    <WalletCards size={16} />
                    连接 Leo Wallet
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
                <button className="icon-action" type="button" onClick={lookup} title="刷新 Mapping">
                  <RefreshCw size={16} />
                  <span className="sr-only">刷新 Mapping</span>
                </button>
              </div>

            </div>
          ) : null}

          {pendingPreview ? (
            <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ChainField label="Program" value={pendingPreview.programId} />
                <ChainField label="Function" value={pendingPreview.functionName} />
                <ChainField label="Network" value={pendingPreview.network} />
                <ChainField
                  label="Fee"
                  value={`${pendingPreview.feeMicrocredits} microcredits`}
                />
              </div>
              <ChainField
                label="Operation Marker"
                value={pendingPreview.publicSummary.operationMarker ?? "Unavailable"}
              />
              <details className="mt-3 border-t border-white/10 pt-3">
                <summary className="focus-ring cursor-pointer text-xs font-semibold text-slate-400">
                  查看公开输入
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
                Do not resubmit the same operation while the transaction is pending.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="primary-action"
                  type="button"
                  disabled={busy || transactionSubmissionBlocked}
                  onClick={() => void requestPreparedAction()}
                >
                  <WalletCards size={16} />
                  请求 Wallet 签名
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={busy}
                  onClick={() => setPendingPreview(null)}
                >
                  取消
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
          Wallet Request: <span className="font-mono">{protocolSubmission.walletRequestId}</span>
          {" · "}
          {protocolSubmission.statusText}
          <span className="block text-amber-100/80">{transactionStatus.message}</span>
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
