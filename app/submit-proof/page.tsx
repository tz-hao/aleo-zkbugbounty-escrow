"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Database,
  FlaskConical,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ProofPanel } from "@/components/proof-panel";
import { useAppState } from "@/components/app-state-provider";
import { useAleoWallet } from "@/components/aleo-wallet-provider";
import { DemoRolePreview } from "@/components/demo-role-preview";
import { ExecutionStatusBadge } from "@/components/execution-status-badge";
import { canSubmitProof } from "@/lib/permissions";
import { createMockVaultEngine } from "@/lib/proof-engines/mock-vault-engine";
import type { OnChainBountyState, ProofResult } from "@/lib/models";
import type { PrivateProofInput } from "@/lib/proof-engines/types";
import { translateUiError, zh } from "@/lib/i18n/zh";
import { isAleoFieldLiteral } from "@/lib/aleo-bounty-registry";
import { CANONICAL_ALEO_PROGRAM_ID } from "@/lib/aleo-program";
import {
  DEFAULT_SUBMIT_CLAIM_FEE_MICROCREDITS,
  deriveReporterSecretField,
} from "@/lib/aleo-submit-claim";

type OnChainBountyResponse = {
  bounty?: OnChainBountyState;
  error?: string;
};

type AleoNetworkResponse = {
  network?: {
    status?: string;
    network?: string;
    latestHeight?: number;
  };
};

type SubmissionMode = "real" | "demo";

export default function SubmitProofPage() {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const wallet = useAleoWallet();
  const activeBounties = state.bounties.filter((bounty) => bounty.status === "Active");
  const [bountyId, setBountyId] = useState(activeBounties[0]?.id ?? "");
  const [bugType, setBugType] = useState("");
  const [vaultBalance, setVaultBalance] = useState("100");
  const [totalClaims, setTotalClaims] = useState("80");
  const [totalDeposits, setTotalDeposits] = useState("100");
  const [reservedRewards, setReservedRewards] = useState("20");
  const [withdrawLimit, setWithdrawLimit] = useState("50");
  const [userBalance, setUserBalance] = useState("40");
  const [requestedWithdrawAmount, setRequestedWithdrawAmount] = useState("20");
  const [hiddenDeltaBalance, setHiddenDeltaBalance] = useState("90");
  const [hiddenDeltaClaims, setHiddenDeltaClaims] = useState("30");
  const [hiddenDeltaReservedRewards, setHiddenDeltaReservedRewards] = useState("0");
  const [hiddenDeltaWithdrawAmount, setHiddenDeltaWithdrawAmount] = useState("35");
  const [hiddenDeltaUserBalance, setHiddenDeltaUserBalance] = useState("10");
  const [privateCallSequence, setPrivateCallSequence] = useState("");
  const [privateStateValues, setPrivateStateValues] = useState("");
  const [reporterSecret, setReporterSecret] = useState("");
  const [proof, setProof] = useState<ProofResult | null>(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [onChainBountyId, setOnChainBountyId] = useState("");
  const [onChainBounty, setOnChainBounty] = useState<OnChainBountyState | null>(null);
  const [latestBlockHeight, setLatestBlockHeight] = useState<number | null>(null);
  const [walletClaimFee, setWalletClaimFee] = useState(
    String(DEFAULT_SUBMIT_CLAIM_FEE_MICROCREDITS),
  );
  const [walletClaimError, setWalletClaimError] = useState("");
  const [walletClaimMessage, setWalletClaimMessage] = useState("");
  const [isLoadingBounty, setIsLoadingBounty] = useState(false);
  const [isRequestingWallet, setIsRequestingWallet] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("real");
  const demoAllowed = canSubmitProof(state.currentActor);

  const selectedBounty = useMemo(
    () => state.bounties.find((bounty) => bounty.id === bountyId),
    [bountyId, state.bounties],
  );
  const activeRuleId =
    submissionMode === "real" ? onChainBounty?.ruleId : selectedBounty?.ruleId;
  const privateInputsDisabled =
    submissionMode === "real" ? !onChainBounty : !demoAllowed;

  useEffect(() => {
    const publicBountyId = new URLSearchParams(window.location.search).get("bountyId");
    if (!publicBountyId || !isAleoFieldLiteral(publicBountyId)) return;

    const timeout = window.setTimeout(() => setOnChainBountyId(publicBountyId), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (submissionMode !== "demo") {
      return;
    }
    if (!demoAllowed) {
      setError(zh.submit.forbidden);
      return;
    }
    if (!selectedBounty) {
      setError(zh.submit.noBounty);
      return;
    }

    try {
      setIsGenerating(true);
      const existingNullifiers = state.claims.map((claim) => claim.nullifier);
      const proofInput: PrivateProofInput = {
        vaultBalance: Number(vaultBalance),
        totalClaims: Number(totalClaims),
        totalDeposits: Number(totalDeposits),
        reservedRewards: Number(reservedRewards),
        withdrawLimit: Number(withdrawLimit),
        userBalance: Number(userBalance),
        requestedWithdrawAmount: Number(requestedWithdrawAmount),
        hiddenDeltaBalance: Number(hiddenDeltaBalance),
        hiddenDeltaClaims: Number(hiddenDeltaClaims),
        hiddenDeltaReservedRewards: Number(hiddenDeltaReservedRewards),
        hiddenDeltaWithdrawAmount: Number(hiddenDeltaWithdrawAmount),
        hiddenDeltaUserBalance: Number(hiddenDeltaUserBalance),
        privateCallSequence,
        privateStateValues,
        reporterSecret,
        bugType: bugType.trim() || undefined,
      };
      const nextProof = await createMockVaultEngine(new Set(existingNullifiers)).generateProof(
        proofInput,
        selectedBounty,
      );
      setProof(nextProof);
    } catch (caught) {
      setProof(null);
      setError(caught instanceof Error ? translateUiError(caught.message) : zh.errors.genericProof);
    } finally {
      setIsGenerating(false);
    }
  }

  function clearPrivateInputState() {
    setVaultBalance("");
    setTotalClaims("");
    setTotalDeposits("");
    setReservedRewards("");
    setWithdrawLimit("");
    setUserBalance("");
    setRequestedWithdrawAmount("");
    setHiddenDeltaBalance("");
    setHiddenDeltaClaims("");
    setHiddenDeltaReservedRewards("");
    setHiddenDeltaWithdrawAmount("");
    setHiddenDeltaUserBalance("");
    setPrivateCallSequence("");
    setPrivateStateValues("");
    setReporterSecret("");
  }

  async function loadOnChainBounty() {
    const requestedBountyId = onChainBountyId.trim();
    setWalletClaimError("");
    setWalletClaimMessage("");
    setOnChainBounty(null);
    setLatestBlockHeight(null);
    if (!isAleoFieldLiteral(requestedBountyId)) {
      setWalletClaimError("Bounty ID 必须是公开 Aleo field literal。");
      return;
    }

    setIsLoadingBounty(true);
    try {
      const [bountyResponse, networkResponse] = await Promise.all([
        fetch(`/api/aleo/bounties/${encodeURIComponent(requestedBountyId)}`, {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        }),
        fetch("/api/aleo/network", {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        }),
      ]);
      const bountyPayload = (await bountyResponse.json()) as OnChainBountyResponse;
      const networkPayload = (await networkResponse.json()) as AleoNetworkResponse;
      const height = networkPayload.network?.latestHeight;
      if (!bountyResponse.ok || !bountyPayload.bounty) {
        setWalletClaimError(
          bountyResponse.status === 404
            ? "Aleo Testnet bounties mapping 中未找到该 Bounty。"
            : "无法验证 Aleo Testnet Bounty mapping。",
        );
        return;
      }
      if (
        !networkResponse.ok ||
        networkPayload.network?.status !== "Available" ||
        networkPayload.network.network !== "testnet" ||
        !Number.isSafeInteger(height)
      ) {
        setWalletClaimError("无法确认当前 Aleo Testnet Block Height。");
        return;
      }
      if (bountyPayload.bounty.status !== "Active") {
        setWalletClaimError("该链上 Bounty 当前不是 Active 状态。");
        return;
      }
      if (height! > bountyPayload.bounty.disclosureDeadline) {
        setWalletClaimError("该链上 Bounty 已超过 Disclosure Deadline。");
        return;
      }
      setOnChainBounty(bountyPayload.bounty);
      setLatestBlockHeight(height!);
      setWalletClaimMessage("Mapping found，公开 Bounty 与当前 Testnet 高度已验证。");
    } catch {
      setWalletClaimError("公开 Aleo Testnet 查询暂时不可用。");
    } finally {
      setIsLoadingBounty(false);
    }
  }

  async function requestWalletSignedClaim() {
    setWalletClaimError("");
    setWalletClaimMessage("");
    if (!onChainBounty || latestBlockHeight === null) {
      setWalletClaimError("请先验证真实 Aleo Testnet Bounty mapping。");
      return;
    }
    if (wallet.connectionState !== "Connected" || !wallet.address) {
      setWalletClaimError("请先连接 Aleo Testnet 上的 Leo Wallet。");
      return;
    }

    setIsRequestingWallet(true);
    try {
      const reporterSecretField = await deriveReporterSecretField(reporterSecret);
      await wallet.submitWalletClaim({
        bounty: onChainBounty,
        latestBlockHeight,
        feeMicrocredits: Number(walletClaimFee),
        witness: {
          vaultBalanceBefore: vaultBalance,
          totalDepositsBefore: totalDeposits,
          totalClaimsBefore: totalClaims,
          reservedRewardsBefore: reservedRewards,
          withdrawLimitBefore: withdrawLimit,
          userBalanceBefore: userBalance,
          requestedWithdrawBefore: requestedWithdrawAmount,
          hiddenDeltaBalance,
          hiddenDeltaClaims,
          hiddenDeltaReservedRewards,
          hiddenDeltaWithdrawAmount,
          hiddenDeltaUserBalance,
          reporterSecretField,
        },
      });
      setWalletClaimMessage(
        "Leo Wallet 已接收 submit_claim。当前仅为 Wallet Submitted，尚未标记 Network Confirmed。",
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setWalletClaimError(
        message.includes("deadline")
          ? "Bounty Disclosure Deadline 已经过期。"
          : message.includes("unsigned integer") || message.includes("u64")
            ? "Private Witness 数值必须是有效的非负 u64。"
            : message.includes("Reporter secret")
              ? "Reporter Secret 不能为空。"
              : "Leo Wallet 未接受 submit_claim 请求；未创建任何链上 Claim Receipt。",
      );
    } finally {
      clearPrivateInputState();
      setProof(null);
      setIsRequestingWallet(false);
    }
  }

  function publishClaim() {
    if (!proof?.verified) {
      setError(zh.submit.onlyVerified);
      return;
    }
    try {
      dispatch({ type: "submitClaim", bountyId, proof });
      clearPrivateInputState();
      setProof(null);
      router.push("/public-claims");
    } catch (caught) {
      setError(caught instanceof Error ? translateUiError(caught.message) : zh.errors.genericClaim);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="grid gap-5">
        <div className="surface-card-strong workflow-hero rounded-lg p-6">
          <p className="page-kicker mb-3">{zh.submit.kicker}</p>
          <h1 className="gradient-heading text-3xl font-semibold tracking-normal sm:text-4xl">
            {zh.submit.title}
          </h1>
          <p className="muted-copy mt-3">
            {zh.submit.description}
          </p>
        </div>
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="page-kicker">提交环境</p>
            <p className="mt-1 text-sm text-slate-400">链上 Wallet flow 与本地 Mock flow 严格隔离。</p>
          </div>
          <div
            aria-label="Claim 提交模式"
            className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1"
          >
            <button
              aria-pressed={submissionMode === "real"}
              className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${
                submissionMode === "real"
                  ? "bg-cyan-300/14 text-cyan-100"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
              }`}
              onClick={() => {
                setSubmissionMode("real");
                setProof(null);
                setError("");
              }}
              type="button"
            >
              <Database size={15} aria-hidden="true" />
              Aleo Testnet
            </button>
            <button
              aria-pressed={submissionMode === "demo"}
              className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold ${
                submissionMode === "demo"
                  ? "bg-violet-300/14 text-violet-100"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
              }`}
              onClick={() => {
                setSubmissionMode("demo");
                setProof(null);
                setError("");
              }}
              type="button"
            >
              <FlaskConical size={15} aria-hidden="true" />
              Local Demo
            </button>
          </div>
        </div>
        {submissionMode === "demo" ? <DemoRolePreview /> : null}
        <form className="surface-card grid gap-4 rounded-lg p-5 sm:p-6" onSubmit={handleGenerate}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="page-kicker">
                {submissionMode === "real" ? "链上 Claim" : "本地验证"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {submissionMode === "real"
                  ? "从 Testnet Mapping 读取 Bounty，并由当前 Wallet 签名。"
                  : "Mock proof 仅用于本地流程演示，不代表链上确认。"}
              </p>
            </div>
            {submissionMode === "real" ? (
              <span className="rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                Wallet signature required
              </span>
            ) : (
              <ExecutionStatusBadge kind="local" />
            )}
          </div>
          {submissionMode === "demo" && !demoAllowed ? (
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
              当前 Demo Preview 视角不能提交本地 Proof。请切换为 Whitehat；该设置不改变 Wallet 或链上权限。
            </div>
          ) : null}
          {submissionMode === "demo" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              {zh.submit.selectBounty}
              <select
                className="focus-ring input-surface rounded-lg px-3 py-3"
                    disabled={!demoAllowed}
                onChange={(event) => {
                  setBountyId(event.target.value);
                  setProof(null);
                }}
                value={bountyId}
              >
                {activeBounties.map((bounty) => (
                  <option className="bg-slate-950" key={bounty.id} value={bounty.id}>
                    {bounty.projectName}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              {zh.submit.selectEngine}
              <select
                className="focus-ring input-surface rounded-lg px-3 py-3"
                disabled
                value="Mock Invariant Engine"
              >
                <option className="bg-slate-950">Mock Invariant Engine</option>
              </select>
            </label>
              </div>
              <div className="border-l-2 border-violet-300/35 bg-violet-300/[0.05] px-4 py-3 text-sm text-violet-100">
                <span className="font-semibold">{zh.submit.capability}：</span>{" "}
                {zh.submit.capabilities.mock} Real Mode 不调用服务端 Prover，也不会回退为 Mock Verified。
              </div>
              <div className="border-y border-white/10 py-3 text-sm text-slate-300">
                {zh.submit.rule}：{" "}
                <span className="font-mono text-emerald-100">
                  {selectedBounty?.ruleText ?? zh.submit.noBounty}
                </span>
                {selectedBounty ? (
                  <span className="mt-2 block text-slate-400">
                    {selectedBounty.ruleName} · {selectedBounty.affectedModule}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 border-y border-white/10 py-4 md:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm text-slate-300">
                  On-chain Bounty ID
                  <input
                    autoComplete="off"
                    className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                    onChange={(event) => {
                      setOnChainBountyId(event.target.value);
                      setOnChainBounty(null);
                      setLatestBlockHeight(null);
                      setWalletClaimMessage("");
                    }}
                    placeholder="123field"
                    spellCheck={false}
                    value={onChainBountyId}
                  />
                </label>
                <button
                  className="focus-ring secondary-action self-end"
                  disabled={isLoadingBounty}
                  onClick={() => void loadOnChainBounty()}
                  type="button"
                >
                  {isLoadingBounty ? (
                    <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
                  ) : (
                    <Database size={16} aria-hidden="true" />
                  )}
                  {isLoadingBounty ? "查询 Mapping" : "验证链上 Bounty"}
                </button>
              </div>
              <div className="border-l-2 border-cyan-300/35 bg-cyan-300/[0.04] px-4 py-3">
                <p className="text-sm font-semibold text-cyan-50">
                  {wallet.address && wallet.connectionState === "Connected"
                    ? "当前钱包将作为 Whitehat / Reporter 提交 Claim"
                    : "连接钱包后，该地址将作为 Whitehat / Reporter 提交 Claim"}
                </p>
                <p className="mt-1 break-all text-xs leading-5 text-slate-400">
                  {wallet.address && wallet.connectionState === "Connected"
                    ? wallet.address
                    : "Real Mode 不读取 Demo Preview 身份；Program 使用 self.signer 确认提交者。"}
                </p>
              </div>
              {onChainBounty && latestBlockHeight !== null ? (
                <dl className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
                  <WalletFact label="Status" value={onChainBounty.status} />
                  <WalletFact label="Rule" value={onChainBounty.ruleId} />
                  <WalletFact label="Scope Hash" value={onChainBounty.scopeHash} />
                  <WalletFact label="Owner" value={onChainBounty.owner} />
                  <WalletFact label="Deadline" value={String(onChainBounty.disclosureDeadline)} />
                  <WalletFact label="Current Height" value={String(latestBlockHeight)} />
                </dl>
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  先验证真实 Testnet Mapping，页面才会加载该 Rule 对应的私密输入。
                </p>
              )}
              {walletClaimMessage ? (
                <p className="flex items-start gap-2 text-sm text-cyan-100" role="status">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-cyan-200" size={16} aria-hidden="true" />
                  {walletClaimMessage}
                </p>
              ) : null}
              {walletClaimError ? (
                <p className="text-sm text-red-200" role="alert">
                  {walletClaimError}
                </p>
              ) : null}
            </>
          )}
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/8 p-3 text-sm text-cyan-100">
            {zh.privacy.privateWitnessTemporary}
          </div>
          {submissionMode === "demo" ? (
            <label className="grid gap-2 text-sm text-slate-300">
              {zh.submit.bugType}
              <input
                className="focus-ring input-surface rounded-lg px-3 py-3"
                disabled={!demoAllowed}
                onChange={(event) => setBugType(event.target.value)}
                value={bugType}
              />
            </label>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <p className="text-sm font-semibold text-white md:col-span-2">Private Witness 输入</p>
            {activeRuleId === "vault-accounting-safety" ? (
              <>
                <NumberField disabled={privateInputsDisabled} label="vaultBalance" onChange={setVaultBalance} value={vaultBalance} />
                <NumberField disabled={privateInputsDisabled} label="totalClaims" onChange={setTotalClaims} value={totalClaims} />
                <NumberField disabled={privateInputsDisabled} label="hiddenDeltaBalance" onChange={setHiddenDeltaBalance} value={hiddenDeltaBalance} />
                <NumberField disabled={privateInputsDisabled} label="hiddenDeltaClaims" onChange={setHiddenDeltaClaims} value={hiddenDeltaClaims} />
              </>
            ) : null}
            {activeRuleId === "claims-vs-deposits" ? (
              <>
                <NumberField disabled={privateInputsDisabled} label="totalDeposits" onChange={setTotalDeposits} value={totalDeposits} />
                <NumberField disabled={privateInputsDisabled} label="totalClaims" onChange={setTotalClaims} value={totalClaims} />
                <NumberField disabled={privateInputsDisabled} label="hiddenDeltaClaims" onChange={setHiddenDeltaClaims} value={hiddenDeltaClaims} />
              </>
            ) : null}
            {activeRuleId === "reward-reserve-safety" ? (
              <>
                <NumberField disabled={privateInputsDisabled} label="vaultBalance" onChange={setVaultBalance} value={vaultBalance} />
                <NumberField disabled={privateInputsDisabled} label="reservedRewards" onChange={setReservedRewards} value={reservedRewards} />
                <NumberField disabled={privateInputsDisabled} label="hiddenDeltaBalance" onChange={setHiddenDeltaBalance} value={hiddenDeltaBalance} />
                <NumberField disabled={privateInputsDisabled} label="hiddenDeltaReservedRewards" onChange={setHiddenDeltaReservedRewards} value={hiddenDeltaReservedRewards} />
              </>
            ) : null}
            {activeRuleId === "withdraw-limit-safety" ? (
              <>
                <NumberField disabled={privateInputsDisabled} label="withdrawLimit" onChange={setWithdrawLimit} value={withdrawLimit} />
                <NumberField disabled={privateInputsDisabled} label="userBalance" onChange={setUserBalance} value={userBalance} />
                <NumberField disabled={privateInputsDisabled} label="requestedWithdrawAmount" onChange={setRequestedWithdrawAmount} value={requestedWithdrawAmount} />
                <NumberField disabled={privateInputsDisabled} label="hiddenDeltaWithdrawAmount" onChange={setHiddenDeltaWithdrawAmount} value={hiddenDeltaWithdrawAmount} />
                <NumberField disabled={privateInputsDisabled} label="hiddenDeltaUserBalance" onChange={setHiddenDeltaUserBalance} value={hiddenDeltaUserBalance} />
              </>
            ) : null}
          </div>
          {submissionMode === "demo" ? (
            <>
              <label className="grid gap-2 text-sm text-slate-300">
                privateCallSequence
                <textarea
                  className="focus-ring input-surface min-h-20 rounded-lg px-3 py-3"
                  disabled={!demoAllowed}
                  onChange={(event) => setPrivateCallSequence(event.target.value)}
                  value={privateCallSequence}
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                privateStateValues
                <textarea
                  className="focus-ring input-surface min-h-20 rounded-lg px-3 py-3"
                  disabled={!demoAllowed}
                  onChange={(event) => setPrivateStateValues(event.target.value)}
                  value={privateStateValues}
                />
              </label>
            </>
          ) : null}
          <label className="grid gap-2 text-sm text-slate-300">
            reporterSecret
            <input
              className="focus-ring input-surface rounded-lg px-3 py-3"
              disabled={privateInputsDisabled}
              onChange={(event) => setReporterSecret(event.target.value)}
              type="password"
              value={reporterSecret}
            />
          </label>
          {submissionMode === "real" ? (
            <section className="border-t border-cyan-300/20 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Wallet-signed submit_claim</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Device-side execution。Private Witness 不发送到 Next.js 或 Vercel。
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-2 text-xs text-cyan-100">
                  <Database size={14} aria-hidden="true" />
                  Testnet mapping
                </span>
              </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
              <label className="grid gap-2 text-sm text-slate-300">
                Public Fee（microcredits）
                <input
                  className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                  min="1"
                  type="number"
                  value={walletClaimFee}
                  onChange={(event) => setWalletClaimFee(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="focus-ring primary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
                  type="button"
                  disabled={
                    !onChainBounty ||
                    latestBlockHeight === null ||
                    wallet.connectionState !== "Connected" ||
                    isRequestingWallet
                  }
                  onClick={() => void requestWalletSignedClaim()}
                >
                  {isRequestingWallet ? (
                    <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
                  ) : (
                    <WalletCards size={16} aria-hidden="true" />
                  )}
                  {isRequestingWallet ? "等待 Leo Wallet" : "请求 Wallet 签名"}
                </button>
                <span className="text-xs text-slate-500">
                  {wallet.connectionState === "Connected" ? "Leo Wallet connected" : "需要连接 Leo Wallet"}
                </span>
                <span className="text-xs text-slate-500">
                  Transaction preview ready: {onChainBounty && latestBlockHeight !== null ? "Ready" : "Awaiting mapping"}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Private Witness 只在当前页面与 Wallet 扩展调用栈中存在；不会进入 Store、URL、日志、Public Metadata 或任何 Next.js Proof API。Wallet 成功、拒绝或异常后都会清空页面私密输入。
            </p>
            {wallet.claimSubmission ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs text-slate-500">
                  {wallet.claimSubmission.publicTransactionId
                    ? "Public Transaction ID"
                    : "Wallet Request ID（尚非链上 Transaction ID）"}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-cyan-100">
                  {wallet.claimSubmission.publicTransactionId ?? wallet.claimSubmission.walletRequestId}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {wallet.claimSubmission.statusText}
                </p>
                <button
                  className="focus-ring secondary-action mt-3"
                  type="button"
                  onClick={() => void wallet.refreshClaimSubmission()}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  刷新 Wallet 状态
                </button>
              </div>
            ) : null}
            </section>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                className="focus-ring secondary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
                disabled={!demoAllowed || isGenerating}
              >
                <ShieldAlert size={17} aria-hidden="true" />
                {zh.submit.generate}
              </button>
              <button
                className="focus-ring primary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
                disabled={!proof?.verified || !demoAllowed || isGenerating}
                onClick={publishClaim}
                type="button"
              >
                <Send size={17} aria-hidden="true" />
                {zh.submit.publish}
              </button>
            </div>
          )}
        </form>
      </section>
      {submissionMode === "demo" ? (
        <ProofPanel error={error} isLoading={isGenerating} proof={proof} />
      ) : (
        <section className="terminal-panel h-fit rounded-lg p-5 lg:sticky lg:top-24">
          <div className="flex items-start gap-3 border-b border-cyan-300/15 pb-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100">
              <LockKeyhole size={19} aria-hidden="true" />
            </span>
            <div>
              <p className="page-kicker">链上提交边界</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Wallet 执行，公开 Registry 验收</h2>
            </div>
          </div>
          <dl className="mt-4">
            <WalletFact label="Program ID" value={CANONICAL_ALEO_PROGRAM_ID} />
            <WalletFact label="Function" value="submit_claim" />
            <WalletFact label="Network" value="Aleo Testnet / testnetbeta" />
            <WalletFact
              label="Wallet"
              value={
                wallet.address && wallet.connectionState === "Connected"
                  ? wallet.address
                  : "Not connected"
              }
            />
            <WalletFact
              label="Bounty Mapping"
              value={onChainBounty ? "Mapping verified" : "Awaiting public mapping query"}
            />
          </dl>
          <div className="mt-4 border-l-2 border-emerald-300/35 pl-3">
            <p className="text-sm font-semibold text-emerald-100">Real Mode 无 Mock fallback</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              服务端 Proof API 保持禁用。Wallet 拒绝、网络不可用或 Mapping 查询失败时，不会显示假成功。
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      {label}
      <input
        className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        required
        type="number"
        value={value}
      />
    </label>
  );
}

function WalletFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-white/10 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-slate-200">{value}</dd>
    </div>
  );
}
