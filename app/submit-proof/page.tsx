"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Database,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ProofPanel } from "@/components/proof-panel";
import { useAppState } from "@/components/app-state-provider";
import { useAleoWallet } from "@/components/aleo-wallet-provider";
import { canSubmitProof } from "@/lib/permissions";
import { createMockVaultEngine } from "@/lib/proof-engines/mock-vault-engine";
import type { OnChainBountyState, ProofResult } from "@/lib/models";
import type { PrivateProofInput } from "@/lib/proof-engines/types";
import { translateUiError, zh } from "@/lib/i18n/zh";
import { isAleoFieldLiteral } from "@/lib/aleo-bounty-registry";
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
  const allowed = canSubmitProof(state.currentActor);

  const selectedBounty = useMemo(
    () => state.bounties.find((bounty) => bounty.id === bountyId),
    [bountyId, state.bounties],
  );

  useEffect(() => {
    const publicBountyId = new URLSearchParams(window.location.search).get("bountyId");
    if (!publicBountyId || !isAleoFieldLiteral(publicBountyId)) return;

    const timeout = window.setTimeout(() => setOnChainBountyId(publicBountyId), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!allowed) {
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
    if (!allowed) {
      setWalletClaimError("只有 Whitehat 可以请求 submit_claim。");
      return;
    }
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
        <div className="surface-card-strong rounded-lg p-6">
          <p className="page-kicker mb-3">{zh.submit.kicker}</p>
          <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            {zh.submit.title}
          </h1>
          <p className="muted-copy mt-3">
            {zh.submit.description}
          </p>
        </div>
        <form className="surface-card grid gap-4 rounded-lg p-5 sm:p-6" onSubmit={handleGenerate}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="page-kicker">Demo Mode</p>
              <p className="mt-1 text-sm text-slate-400">本地 Mock 验证，不代表 Aleo Testnet Proof。</p>
            </div>
            <span className="rounded-md border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-xs text-violet-100">
              Mock only
            </span>
          </div>
          {!allowed ? (
            <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">
              {zh.submit.forbidden}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              {zh.submit.selectBounty}
              <select
                className="focus-ring input-surface rounded-lg px-3 py-3"
                disabled={!allowed}
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
          <div className="rounded-lg border border-violet-300/20 bg-violet-300/[0.07] p-3 text-sm text-violet-100">
            <span className="font-semibold">{zh.submit.capability}：</span>{" "}
            {zh.submit.capabilities.mock} Real Mode 不会调用服务端 Prover，也不会回退为 Mock Verified。
          </div>
          <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/8 p-3 text-sm text-emerald-100">
            {zh.submit.rule}：<span className="font-mono">{selectedBounty?.ruleText ?? zh.submit.noBounty}</span>
            {selectedBounty ? (
              <span className="mt-2 block text-emerald-50">
                {selectedBounty.ruleName} - {selectedBounty.affectedModule}
              </span>
            ) : null}
          </div>
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/8 p-3 text-sm text-cyan-100">
            {zh.privacy.privateWitnessTemporary}
          </div>
          <label className="grid gap-2 text-sm text-slate-300">
            {zh.submit.bugType}
            <input
              className="focus-ring input-surface rounded-lg px-3 py-3"
              disabled={!allowed}
              onChange={(event) => setBugType(event.target.value)}
              value={bugType}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <p className="text-sm font-semibold text-white md:col-span-2">Private Witness 输入</p>
            {selectedBounty?.ruleId === "vault-accounting-safety" ? (
              <>
                <NumberField disabled={!allowed} label="vaultBalance" onChange={setVaultBalance} value={vaultBalance} />
                <NumberField disabled={!allowed} label="totalClaims" onChange={setTotalClaims} value={totalClaims} />
                <NumberField disabled={!allowed} label="hiddenDeltaBalance" onChange={setHiddenDeltaBalance} value={hiddenDeltaBalance} />
                <NumberField disabled={!allowed} label="hiddenDeltaClaims" onChange={setHiddenDeltaClaims} value={hiddenDeltaClaims} />
              </>
            ) : null}
            {selectedBounty?.ruleId === "claims-vs-deposits" ? (
              <>
                <NumberField disabled={!allowed} label="totalDeposits" onChange={setTotalDeposits} value={totalDeposits} />
                <NumberField disabled={!allowed} label="totalClaims" onChange={setTotalClaims} value={totalClaims} />
                <NumberField disabled={!allowed} label="hiddenDeltaClaims" onChange={setHiddenDeltaClaims} value={hiddenDeltaClaims} />
              </>
            ) : null}
            {selectedBounty?.ruleId === "reward-reserve-safety" ? (
              <>
                <NumberField disabled={!allowed} label="vaultBalance" onChange={setVaultBalance} value={vaultBalance} />
                <NumberField disabled={!allowed} label="reservedRewards" onChange={setReservedRewards} value={reservedRewards} />
                <NumberField disabled={!allowed} label="hiddenDeltaBalance" onChange={setHiddenDeltaBalance} value={hiddenDeltaBalance} />
                <NumberField disabled={!allowed} label="hiddenDeltaReservedRewards" onChange={setHiddenDeltaReservedRewards} value={hiddenDeltaReservedRewards} />
              </>
            ) : null}
            {selectedBounty?.ruleId === "withdraw-limit-safety" ? (
              <>
                <NumberField disabled={!allowed} label="withdrawLimit" onChange={setWithdrawLimit} value={withdrawLimit} />
                <NumberField disabled={!allowed} label="userBalance" onChange={setUserBalance} value={userBalance} />
                <NumberField disabled={!allowed} label="requestedWithdrawAmount" onChange={setRequestedWithdrawAmount} value={requestedWithdrawAmount} />
                <NumberField disabled={!allowed} label="hiddenDeltaWithdrawAmount" onChange={setHiddenDeltaWithdrawAmount} value={hiddenDeltaWithdrawAmount} />
                <NumberField disabled={!allowed} label="hiddenDeltaUserBalance" onChange={setHiddenDeltaUserBalance} value={hiddenDeltaUserBalance} />
              </>
            ) : null}
          </div>
          <label className="grid gap-2 text-sm text-slate-300">
            privateCallSequence
            <textarea
              className="focus-ring input-surface min-h-20 rounded-lg px-3 py-3"
              disabled={!allowed}
              onChange={(event) => setPrivateCallSequence(event.target.value)}
              value={privateCallSequence}
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            privateStateValues
            <textarea
              className="focus-ring input-surface min-h-20 rounded-lg px-3 py-3"
              disabled={!allowed}
              onChange={(event) => setPrivateStateValues(event.target.value)}
              value={privateStateValues}
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            reporterSecret
            <input
              className="focus-ring input-surface rounded-lg px-3 py-3"
              disabled={!allowed}
              onChange={(event) => setReporterSecret(event.target.value)}
              type="password"
              value={reporterSecret}
            />
          </label>
          <section className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.055] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="page-kicker">Aleo Testnet · Real Mode</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Device-side Proof · Wallet-signed submit_claim</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Private Witness 直接交给 Leo Wallet 执行 canonical Program，不发送到 Next.js 或 Vercel。
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-2 text-xs text-cyan-100">
                <Database size={14} aria-hidden="true" />
                bounties mapping
              </span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="grid gap-2 text-sm text-slate-300">
                On-chain Bounty ID
                <input
                  className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                  value={onChainBountyId}
                  onChange={(event) => {
                    setOnChainBountyId(event.target.value);
                    setOnChainBounty(null);
                    setLatestBlockHeight(null);
                    setWalletClaimMessage("");
                  }}
                  placeholder="123field"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button
                className="focus-ring secondary-action self-end"
                type="button"
                disabled={isLoadingBounty}
                onClick={() => void loadOnChainBounty()}
              >
                {isLoadingBounty ? (
                  <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
                ) : (
                  <Database size={16} aria-hidden="true" />
                )}
                {isLoadingBounty ? "查询 Mapping" : "验证链上 Bounty"}
              </button>
            </div>

            {onChainBounty && latestBlockHeight !== null ? (
              <dl className="mt-4 grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
                <WalletFact label="Status" value={onChainBounty.status} />
                <WalletFact label="Rule" value={onChainBounty.ruleId} />
                <WalletFact label="Scope Hash" value={onChainBounty.scopeHash} />
                <WalletFact label="Owner" value={onChainBounty.owner} />
                <WalletFact label="Deadline" value={String(onChainBounty.disclosureDeadline)} />
                <WalletFact label="Current Height" value={String(latestBlockHeight)} />
              </dl>
            ) : null}

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
                    !allowed ||
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
            {walletClaimMessage ? (
              <p className="mt-3 flex items-start gap-2 text-sm text-emerald-100" role="status">
                <CheckCircle2 className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                {walletClaimMessage}
              </p>
            ) : null}
            {walletClaimError ? (
              <p className="mt-3 text-sm text-red-200" role="alert">{walletClaimError}</p>
            ) : null}

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
          <div className="flex flex-wrap gap-3">
            <button
              className="focus-ring secondary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
              disabled={!allowed || isGenerating}
            >
              <ShieldAlert size={17} aria-hidden="true" />
              {zh.submit.generate}
            </button>
            <button
              className="focus-ring primary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
              disabled={!proof?.verified || !allowed || isGenerating}
              onClick={publishClaim}
              type="button"
            >
              <Send size={17} aria-hidden="true" />
              {zh.submit.publish}
            </button>
          </div>
        </form>
      </section>
      <ProofPanel error={error} isLoading={isGenerating} proof={proof} />
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
