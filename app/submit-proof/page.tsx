"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Database,
  FlaskConical,
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
import { AleoSubmitClaimV3Panel } from "@/components/aleo-submit-claim-v3-panel";
import { DemoRolePreview } from "@/components/demo-role-preview";
import { ExecutionStatusBadge } from "@/components/execution-status-badge";
import { canSubmitProof } from "@/lib/permissions";
import { createMockVaultEngine } from "@/lib/proof-engines/mock-vault-engine";
import type { OnChainBountyState, ProofResult } from "@/lib/models";
import type { PrivateProofInput } from "@/lib/proof-engines/types";
import { getChineseProtocolValue, translateUiError } from "@/lib/i18n/zh";
import { getLocalizedWalletMessage } from "@/lib/i18n/wallet";
import { useLocale } from "@/components/locale-provider";
import { isAleoFieldLiteral } from "@/lib/aleo-bounty-registry";
import {
  DEFAULT_SUBMIT_CLAIM_FEE_MICROCREDITS,
  deriveReporterSecretField,
} from "@/lib/aleo-submit-claim";
import { SUBMIT_CLAIM_V2_FUNCTION } from "@/lib/aleo-submit-claim-v2";
import { CANONICAL_ALEO_PROGRAM_ID } from "@/lib/aleo-program";

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

type OnChainEscrowResponse = {
  protocolVersion?: number;
  error?: string;
};

type SubmissionMode = "real" | "demo";

export default function SubmitProofPage() {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const wallet = useAleoWallet();
  const { copy, text } = useLocale();
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
  const [onChainProtocolVersion, setOnChainProtocolVersion] = useState<number | null>(null);
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
  const walletIsBountyOwner =
    wallet.connectionState === "Connected" &&
    Boolean(wallet.address) &&
    Boolean(onChainBounty) &&
    wallet.address!.toLowerCase() === onChainBounty!.owner.toLowerCase();
  const privateInputsDisabled =
    submissionMode === "real"
      ? !onChainBounty || onChainProtocolVersion !== 2
      : !demoAllowed;

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
      setError(copy.submit.forbidden);
      return;
    }
    if (!selectedBounty) {
      setError(copy.submit.noBounty);
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
      setError(caught instanceof Error ? translateUiError(caught.message) : copy.errors.genericProof);
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
    setOnChainProtocolVersion(null);
    setLatestBlockHeight(null);
    if (!isAleoFieldLiteral(requestedBountyId)) {
      setWalletClaimError(text("赏金编号必须是公开 Aleo field 字面量。", "Bounty ID must be a public Aleo field literal."));
      return;
    }

    setIsLoadingBounty(true);
    try {
      const [bountyResponse, networkResponse, escrowResponse] = await Promise.all([
        fetch("/api/aleo/bounties/" + encodeURIComponent(requestedBountyId), {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        }),
        fetch("/api/aleo/network", {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        }),
        fetch("/api/aleo/escrow/" + encodeURIComponent(requestedBountyId), {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
        }),
      ]);
      const bountyPayload = (await bountyResponse.json()) as OnChainBountyResponse;
      const networkPayload = (await networkResponse.json()) as AleoNetworkResponse;
      const escrowPayload = (await escrowResponse.json().catch(() => null)) as OnChainEscrowResponse | null;      const height = networkPayload.network?.latestHeight;
      if (!bountyResponse.ok || !bountyPayload.bounty) {
        setWalletClaimError(
          bountyResponse.status === 404
            ? text("Aleo 测试网的赏金映射中未找到该赏金。", "The Bounty was not found in the Aleo Testnet bounties mapping.")
            : text("无法验证 Aleo 测试网赏金映射。", "Unable to verify the Aleo Testnet Bounty mapping."),
        );
        return;
      }
      if (
        !networkResponse.ok ||
        networkPayload.network?.status !== "Available" ||
        networkPayload.network.network !== "testnet" ||
        !Number.isSafeInteger(height)
      ) {
        setWalletClaimError(text("无法确认当前 Aleo 测试网区块高度。", "Unable to confirm the current Aleo Testnet block height."));
        return;
      }
      if (bountyPayload.bounty.status !== "Active") {
        setWalletClaimError(text("该链上赏金当前不是进行中状态。", "This on-chain Bounty is not currently Active."));
        return;
      }
      if (height! > bountyPayload.bounty.disclosureDeadline) {
        setWalletClaimError(text("该链上赏金已超过披露期限。", "This on-chain Bounty has passed its Disclosure Deadline."));
        return;
      }
      if (!escrowResponse.ok || escrowPayload?.protocolVersion !== 2) {
        setWalletClaimError(text(
          "该赏金不是协议 v2 赏金，不能使用 submit_claim_v2 或进入链上托管分诊流程。请创建新的 v2 赏金。",
          "This Bounty is not protocol v2. It cannot use submit_claim_v2 or enter the on-chain Escrow Triage flow. Create a new v2 Bounty.",
        ));
        return;
      }
      setOnChainBounty(bountyPayload.bounty);
      setOnChainProtocolVersion(2);
      setLatestBlockHeight(height!);
      setWalletClaimMessage(text("已找到协议 v2 链上映射：赏金、协议版本与当前测试网高度均已验证。", "Protocol-v2 Mapping found. The public Bounty, protocol version, and current Testnet height are verified."));
    } catch {
      setWalletClaimError(text("Aleo 测试网公开查询暂时不可用。", "Public Aleo Testnet queries are temporarily unavailable."));
    } finally {
      setIsLoadingBounty(false);
    }
  }

  async function requestWalletSignedClaim() {
    setWalletClaimError("");
    setWalletClaimMessage("");
    if (!onChainBounty || latestBlockHeight === null || onChainProtocolVersion !== 2) {
      setWalletClaimError(text("请先验证真实 Aleo 测试网的协议 v2 赏金映射。", "Verify a real protocol-v2 Aleo Testnet Bounty mapping first."));
      return;
    }
    if (wallet.connectionState !== "Connected" || !wallet.address) {
      setWalletClaimError(text("请先连接已切换到 Aleo 测试网的 Leo Wallet。", "Connect Leo Wallet on Aleo Testnet first."));
      return;
    }
    if (walletIsBountyOwner) {
      setWalletClaimError(
        text(
          "当前连接的钱包是该赏金所有者。请切换到独立的白帽钱包后再提交，避免将 claim_reporters 写成所有者地址。",
          "The connected Wallet owns this Bounty. Switch to an independent Whitehat Wallet before submitting so claim_reporters is not written as the owner address.",
        ),
      );
      return;
    }
    if (wallet.transactionSubmissionBlocked) {
      setWalletClaimError(text("已有公开交易正在等待签名、广播或确认。请勿重复提交同一操作。", "A public transaction is waiting for signing, broadcast, or confirmation. Do not submit the same operation again."));
      return;
    }

    setIsRequestingWallet(true);
    try {
      const reporterSecretField = await deriveReporterSecretField(reporterSecret);
      await wallet.submitWalletClaimV2({
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
        text("Leo Wallet 已接收 submit_claim_v2。当前仅表示钱包已提交，尚未达到网络确认状态。确认后请从公开注册表读取收据，再进入链上分诊。", "Leo Wallet received submit_claim_v2. This is Wallet Submitted only, not Network Confirmed. After confirmation, read the Receipt from the public Registry before opening on-chain Triage."),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      setWalletClaimError(
        message.includes("deadline")
          ? text("赏金披露期限已过期。", "The Bounty Disclosure Deadline has expired.")
          : message.includes("unsigned integer") || message.includes("u64")
            ? text("私有见证数据必须是有效的非负 u64 数值。", "Private Witness values must be valid non-negative u64 values.")
            : message.includes("Reporter secret")
              ? text("报告人秘密值不能为空。", "Reporter Secret cannot be empty.")
              : message.includes("交易已取消") || message.includes("签名被拒绝")
                ? text("交易已取消或签名被拒绝，未创建任何链上漏洞声明收据。", "Transaction cancelled / signature rejected. No on-chain Claim Receipt was created.")
                : message.includes("Testnet")
                  ? text("钱包当前不在 Aleo 测试网。请切换网络后重新生成交易预览。", "Wallet is not on Aleo Testnet. Switch networks and regenerate the preview.")
                  : text("交易未能完成，未创建任何链上漏洞声明收据。", "Transaction could not be completed. No on-chain Claim Receipt was created."),
      );
    } finally {
      clearPrivateInputState();
      setProof(null);
      setIsRequestingWallet(false);
    }
  }

  function publishClaim() {
    if (!proof?.verified) {
      setError(copy.submit.onlyVerified);
      return;
    }
    try {
      dispatch({ type: "submitClaim", bountyId, proof });
      clearPrivateInputState();
      setProof(null);
      router.push("/public-claims");
    } catch (caught) {
      setError(caught instanceof Error ? translateUiError(caught.message) : copy.errors.genericClaim);
    }
  }

  return (
    <div
      className={`mx-auto grid w-full gap-4 ${
        submissionMode === "demo"
          ? "max-w-7xl xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]"
          : "max-w-5xl"
      }`}
    >
      <section className="grid gap-4">
        <div className="surface-card-strong rounded-lg p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="page-kicker mb-2">{copy.submit.kicker}</p>
              <h1 className="gradient-heading text-2xl font-semibold sm:text-3xl">
                {copy.submit.title}
              </h1>
              <p className="mt-2 text-sm text-slate-400">{copy.submit.description}</p>
            </div>
          <div
            aria-label={text("漏洞声明提交模式", "Claim submission mode")}
              className="grid shrink-0 grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1"
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
              {text("本地演示", "Local Demo")}
            </button>
          </div>
          </div>
        </div>
        {submissionMode === "demo" ? <DemoRolePreview /> : null}
        {submissionMode === "real" ? <AleoSubmitClaimV3Panel /> : null}
        <form className="surface-card grid gap-4 rounded-lg p-5" onSubmit={handleGenerate}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <p className="page-kicker">
              {submissionMode === "real" ? text("测试网漏洞声明", "Testnet claim") : text("本地验证", "Local verification")}
            </p>
            {submissionMode === "real" ? (
              <span className="text-xs font-semibold text-cyan-100">
                Mapping → Witness → Wallet
              </span>
            ) : (
              <ExecutionStatusBadge kind="local" />
            )}
          </div>
          {submissionMode === "demo" && !demoAllowed ? (
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
              {text("当前本地演示视角不能提交本地证明。请切换为白帽研究员；该设置不改变钱包或链上权限。", "The current Demo Preview role cannot submit a local Proof. Switch to Whitehat; this does not change Wallet or on-chain authority.")}
            </div>
          ) : null}
          {submissionMode === "demo" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-300">
              {copy.submit.selectBounty}
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
                    {text(getChineseProtocolValue(bounty.projectName), bounty.projectName)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              {copy.submit.selectEngine}
              <select
                className="focus-ring input-surface rounded-lg px-3 py-3"
                disabled
                value="Mock Invariant Engine"
              >
                <option className="bg-slate-950">{text("模拟不变量引擎", "Mock Invariant Engine")}</option>
              </select>
            </label>
              </div>
              <div className="border-l-2 border-violet-300/35 bg-violet-300/[0.05] px-4 py-3 text-sm text-violet-100">
                <span className="font-semibold">{copy.submit.capability}：</span>{" "}
                {copy.submit.capabilities.mock} {text("真实模式不调用服务端证明器，也不会回退为模拟验证成功。", "Real Mode does not call a server-side prover and does not fall back to Mock Verified.")}
              </div>
              <div className="border-y border-white/10 py-3 text-sm text-slate-300">
                {copy.submit.rule}：{" "}
                <span className="font-mono text-emerald-100">
                  {selectedBounty?.ruleText ?? copy.submit.noBounty}
                </span>
                {selectedBounty ? (
                  <span className="mt-2 block text-slate-400">
                    {text(getChineseProtocolValue(selectedBounty.ruleName), selectedBounty.ruleName)} · {text(getChineseProtocolValue(selectedBounty.affectedModule), selectedBounty.affectedModule)}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-3 border-y border-white/10 py-4 md:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm text-slate-300">
                  {text("链上赏金编号", "On-chain Bounty ID")}
                  <input
                    autoComplete="off"
                    className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                    onChange={(event) => {
                      setOnChainBountyId(event.target.value);
                      setOnChainBounty(null);
                      setOnChainProtocolVersion(null);
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
                  {isLoadingBounty ? text("查询链上映射", "Query mapping") : text("验证链上赏金", "Verify on-chain Bounty")}
                </button>
              </div>
              <div className="flex min-w-0 flex-col gap-1 border-l-2 border-cyan-300/35 bg-cyan-300/[0.04] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="shrink-0 text-sm font-semibold text-cyan-50">
                  {text("当前钱包将作为白帽研究员与报告人", "The current Wallet will act as Whitehat / Reporter")}
                </p>
                <p
                  className="min-w-0 truncate font-mono text-xs text-slate-400"
                  title={
                    wallet.address && wallet.connectionState === "Connected"
                      ? wallet.address
                      : text("等待连接 Leo Wallet", "Waiting for Leo Wallet connection")
                  }
                >
                  {wallet.address && wallet.connectionState === "Connected"
                    ? wallet.address
                    : text("等待连接 Leo Wallet", "Waiting for Leo Wallet connection")}
                </p>
              </div>
              {walletIsBountyOwner ? (
                <p className="border-l-2 border-amber-300/55 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100" role="alert">
                  {text(
                    "当前钱包是该赏金所有者。为保持白帽报告人与项目方分离，请切换到独立的白帽钱包；本页不会请求签名。",
                    "The current Wallet owns this Bounty. Switch to an independent Whitehat Wallet to keep the reporter separate from the project owner; this page will not request a signature.",
                  )}
                </p>
              ) : null}
              {onChainBounty && latestBlockHeight !== null ? (
                <dl className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
                  <WalletFact label={text("状态", "Status")} value={copy.status.bounty[onChainBounty.status]} />
                  <WalletFact label={text("安全规则", "Rule")} value={onChainBounty.ruleId} />
                  <WalletFact label={text("范围哈希", "Scope Hash")} value={onChainBounty.scopeHash} />
                  <WalletFact label={text("所有者", "Owner")} value={onChainBounty.owner} />
                  <WalletFact label={text("披露期限", "Deadline")} value={String(onChainBounty.disclosureDeadline)} />
                  <WalletFact label={text("当前区块高度", "Current Height")} value={String(latestBlockHeight)} />
                  <WalletFact label={text("协议版本", "Protocol Version")} value={"v" + String(onChainProtocolVersion)} />
                </dl>
              ) : (
                <p className="text-sm text-slate-500">{text("验证链上映射后显示对应安全规则输入。", "Verify the Mapping to display the matching Rule inputs.")}</p>
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
          <div className="border-l-2 border-cyan-300/30 px-3 py-1 text-xs text-cyan-100">
            {copy.privacy.privateWitnessTemporary}
          </div>
          {submissionMode === "demo" ? (
            <label className="grid gap-2 text-sm text-slate-300">
              {copy.submit.bugType}
              <input
                className="focus-ring input-surface rounded-lg px-3 py-3"
                disabled={!demoAllowed}
                onChange={(event) => setBugType(event.target.value)}
                value={bugType}
              />
            </label>
          ) : null}
          {submissionMode === "demo" || onChainBounty ? (
          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-sm font-semibold text-white md:col-span-2">{text("私有见证数据输入", "Private Witness inputs")}</p>
            {activeRuleId === "vault-accounting-safety" ? (
              <>
                <NumberField disabled={privateInputsDisabled} label={text("金库余额", "vaultBalance")} onChange={setVaultBalance} value={vaultBalance} />
                <NumberField disabled={privateInputsDisabled} label={text("索赔总额", "totalClaims")} onChange={setTotalClaims} value={totalClaims} />
                <NumberField disabled={privateInputsDisabled} label={text("隐藏余额变化量", "hiddenDeltaBalance")} onChange={setHiddenDeltaBalance} value={hiddenDeltaBalance} />
                <NumberField disabled={privateInputsDisabled} label={text("隐藏索赔变化量", "hiddenDeltaClaims")} onChange={setHiddenDeltaClaims} value={hiddenDeltaClaims} />
              </>
            ) : null}
            {activeRuleId === "claims-vs-deposits" ? (
              <>
                <NumberField disabled={privateInputsDisabled} label={text("存款总额", "totalDeposits")} onChange={setTotalDeposits} value={totalDeposits} />
                <NumberField disabled={privateInputsDisabled} label={text("索赔总额", "totalClaims")} onChange={setTotalClaims} value={totalClaims} />
                <NumberField disabled={privateInputsDisabled} label={text("隐藏索赔变化量", "hiddenDeltaClaims")} onChange={setHiddenDeltaClaims} value={hiddenDeltaClaims} />
              </>
            ) : null}
            {activeRuleId === "reward-reserve-safety" ? (
              <>
                <NumberField disabled={privateInputsDisabled} label={text("金库余额", "vaultBalance")} onChange={setVaultBalance} value={vaultBalance} />
                <NumberField disabled={privateInputsDisabled} label={text("预留奖励", "reservedRewards")} onChange={setReservedRewards} value={reservedRewards} />
                <NumberField disabled={privateInputsDisabled} label={text("隐藏余额变化量", "hiddenDeltaBalance")} onChange={setHiddenDeltaBalance} value={hiddenDeltaBalance} />
                <NumberField disabled={privateInputsDisabled} label={text("隐藏预留奖励变化量", "hiddenDeltaReservedRewards")} onChange={setHiddenDeltaReservedRewards} value={hiddenDeltaReservedRewards} />
              </>
            ) : null}
            {activeRuleId === "withdraw-limit-safety" ? (
              <>
                <NumberField disabled={privateInputsDisabled} label={text("提款限额", "withdrawLimit")} onChange={setWithdrawLimit} value={withdrawLimit} />
                <NumberField disabled={privateInputsDisabled} label={text("用户余额", "userBalance")} onChange={setUserBalance} value={userBalance} />
                <NumberField disabled={privateInputsDisabled} label={text("申请提款金额", "requestedWithdrawAmount")} onChange={setRequestedWithdrawAmount} value={requestedWithdrawAmount} />
                <NumberField disabled={privateInputsDisabled} label={text("隐藏提款变化量", "hiddenDeltaWithdrawAmount")} onChange={setHiddenDeltaWithdrawAmount} value={hiddenDeltaWithdrawAmount} />
                <NumberField disabled={privateInputsDisabled} label={text("隐藏用户余额变化量", "hiddenDeltaUserBalance")} onChange={setHiddenDeltaUserBalance} value={hiddenDeltaUserBalance} />
              </>
            ) : null}
          </div>
          ) : null}
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
          {submissionMode === "demo" || onChainBounty ? (
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
          ) : null}
          {submissionMode === "real" ? (
            onChainBounty && latestBlockHeight !== null && onChainProtocolVersion === 2 ? (
              <section className="border-t border-cyan-300/20 pt-4">
                <div>
                  <p className="text-sm font-semibold text-white">{text("由钱包签名的 submit_claim_v2", "Wallet-signed submit_claim_v2")}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {text("设备端执行 · 私有见证数据不会离开钱包边界", "Device-side execution · Private Witness stays within the Wallet boundary")}
                  </p>
                </div>
                <div className="mt-3 grid gap-3 border-y border-white/10 py-3 sm:grid-cols-2 lg:grid-cols-4">
                  <WalletFact label={text("程序", "Program")} value={CANONICAL_ALEO_PROGRAM_ID} />
                  <WalletFact label={text("函数", "Function")} value={SUBMIT_CLAIM_V2_FUNCTION} />
                  <WalletFact label={text("网络", "Network")} value={text("Aleo 测试网", "Aleo Testnet")} />
                  <WalletFact label={text("公开输入", "Public Inputs")} value={text("赏金编号、范围哈希、规则编号", "Bounty ID, Scope Hash, Rule ID")} />
                  <WalletFact
                    label={text("将写入的报告人", "Reporter to be written")}
                    value={wallet.address && wallet.connectionState === "Connected" ? wallet.address : text("等待钱包连接", "Waiting for Wallet connection")}
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
                  <label className="grid gap-2 text-sm text-slate-300">
                    {text("公开交易费（microcredits）", "Public fee (microcredits)")}
                    <input
                      className="focus-ring input-surface rounded-lg px-3 py-3 font-mono"
                      min="1"
                      onChange={(event) => setWalletClaimFee(event.target.value)}
                      type="number"
                      value={walletClaimFee}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="focus-ring primary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
                      disabled={
                        wallet.connectionState !== "Connected" ||
                        walletIsBountyOwner ||
                        isRequestingWallet ||
                        wallet.transactionSubmissionBlocked
                      }
                      onClick={() => void requestWalletSignedClaim()}
                      type="button"
                    >
                      {isRequestingWallet ? (
                        <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
                      ) : (
                        <WalletCards size={16} aria-hidden="true" />
                      )}
                      {isRequestingWallet ? text("等待 Leo Wallet 响应", "Waiting for Leo Wallet") : text("请求钱包签名", "Request Wallet signature")}
                    </button>
                    <span className="text-xs text-slate-500">
                      {wallet.connectionState === "Connected"
                        ? text("交易预览已就绪", "Transaction preview ready")
                        : text("需要连接 Leo Wallet", "Leo Wallet connection required")}
                    </span>
                  </div>
                </div>
                {wallet.claimSubmission ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-xs text-slate-500">
                      {wallet.claimSubmission.publicTransactionId
                        ? text("公开交易编号", "Public Transaction ID")
                        : text("钱包请求编号（尚非链上交易编号）", "Wallet Request ID (not yet an on-chain Transaction ID)")}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-cyan-100">
                      {wallet.claimSubmission.publicTransactionId ??
                        wallet.claimSubmission.walletRequestId}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {getLocalizedWalletMessage(wallet.claimSubmission.statusText, text)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {text(
                        "仅在钱包处理完成且公开注册表读到 v2 收据、报告人和防重复标识映射后，才能在“漏洞分诊”继续链上操作。",
                        "Continue to on-chain Triage only after the public Registry reads the v2 Receipt, Reporter, and Nullifier Mappings.",
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="focus-ring secondary-action"
                        onClick={() => void wallet.refreshClaimSubmission()}
                        type="button"
                      >
                        <RefreshCw size={15} aria-hidden="true" />
                        {text("刷新钱包状态", "Refresh Wallet status")}
                      </button>
                      <button
                        className="focus-ring secondary-action"
                        onClick={() => router.push("/public-claims")}
                        type="button"
                      >
                        <Database size={15} aria-hidden="true" />
                        {text("在公开注册表核验", "Verify in Public Registry")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                className="focus-ring secondary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
                disabled={!demoAllowed || isGenerating}
              >
                <ShieldAlert size={17} aria-hidden="true" />
                {copy.submit.generate}
              </button>
              <button
                className="focus-ring primary-action disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
                disabled={!proof?.verified || !demoAllowed || isGenerating}
                onClick={publishClaim}
                type="button"
              >
                <Send size={17} aria-hidden="true" />
                {copy.submit.publish}
              </button>
            </div>
          )}
        </form>
      </section>
      {submissionMode === "demo" ? (
        <ProofPanel error={error} isLoading={isGenerating} proof={proof} />
      ) : null}
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
