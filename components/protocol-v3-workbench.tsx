"use client";

import {
  Gavel,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAleoWallet } from "./aleo-wallet-provider";
import { useLocale } from "./locale-provider";
import { ProtocolV3SecureDelivery } from "./protocol-v3-secure-delivery";
import {
  buildCastArbitrationVoteV3Transaction,
  buildDisclosureActionV3Transaction,
  buildDisputeClaimV3Transaction,
  buildFinalizeArbitrationPrelockV3Transaction,
  buildFinalizeRejectionV3Transaction,
  buildFundBountyV3Transaction,
  buildLockRewardV3Transaction,
  buildRefundBountyV3Transaction,
  buildResolutionActionV3Transaction,
  buildReviewClaimV3Transaction,
  buildSettleRewardV3Transaction,
  PROTOCOL_V3_CAPABILITY,
  PROTOCOL_V3_DISPUTE_TYPES,
  type ProtocolV3Capability,
  type ProtocolV3DisputeType,
  type ProtocolV3TransactionPreview,
} from "@/lib/aleo-protocol-v3";
import type {
  OnChainBountyV3Config,
  OnChainClaimV3ArbitrationTally,
  OnChainClaimV3DisputeBond,
  OnChainClaimV3DisputeMetadata,
  OnChainClaimV3ProjectDecision,
  OnChainClaimV3Evidence,
  OnChainClaimV3Payout,
  OnChainClaimV3State,
} from "@/lib/aleo-v3-registry";
import type {
  OnChainBountyState,
  OnChainClaimReceipt,
} from "@/lib/models";

type ClaimBundle = {
  bounty: OnChainBountyState;
  policy: OnChainBountyV3Config;
  receipt: OnChainClaimReceipt;
  reporter: string;
  evidence: OnChainClaimV3Evidence;
  state: OnChainClaimV3State;
  payout: OnChainClaimV3Payout | null;
  tally: OnChainClaimV3ArbitrationTally | null;
  acknowledgement: { acknowledgement: string } | null;
  disputeBond: OnChainClaimV3DisputeBond | null;
  projectDecision: OnChainClaimV3ProjectDecision | null;
  disputeMetadata: OnChainClaimV3DisputeMetadata | null;
};

type LookupClaimOptions = {
  background?: boolean;
};

type ActionId =
  | "begin-review"
  | "accept-claim"
  | "reject-claim"
  | "mark-duplicate"
  | "mark-scope"
  | "assess-severity"
  | "lock-reward"
  | "deliver-disclosure"
  | "acknowledge-disclosure"
  | "confirm-reproduction"
  | "reject-reproduction"
  | "propose-patch"
  | "accept-patch"
  | "finalize-unappealed"
  | "open-dispute"
  | "open-sla-timeout"
  | "cast-vote"
  | "settle-reward"
  | "finalize-prelock"
  | "finalize-rejection";

const actionLabels: Record<ActionId, [string, string]> = {
  "begin-review": ["开始审核", "Begin review"],
  "accept-claim": ["受理 Claim", "Accept Claim"],
  "reject-claim": ["提出拒绝", "Propose rejection"],
  "mark-duplicate": ["标记重复", "Mark duplicate"],
  "mark-scope": ["标记超出范围", "Mark out of scope"],
  "assess-severity": ["记录项目方严重程度", "Record project severity"],
  "lock-reward": ["锁定奖励", "Lock reward"],
  "deliver-disclosure": ["登记加密交付", "Record encrypted delivery"],
  "acknowledge-disclosure": ["确认收到密文", "Acknowledge delivery"],
  "confirm-reproduction": ["确认复现", "Confirm reproduction"],
  "reject-reproduction": ["记录无法复现", "Reject reproduction"],
  "propose-patch": ["提交修复承诺", "Submit patch commitment"],
  "accept-patch": ["确认修复", "Accept patch"],
  "finalize-unappealed": ["终结未申诉拒绝", "Finalize unappealed rejection"],
  "open-dispute": ["发起类型化争议", "Open typed dispute"],
  "open-sla-timeout": ["发起 SLA 超时争议", "Escalate an SLA timeout"],
  "cast-vote": ["提交仲裁票", "Cast arbitration vote"],
  "settle-reward": ["结算奖励", "Settle reward"],
  "finalize-prelock": ["仲裁后先锁款", "Lock award after arbitration"],
  "finalize-rejection": ["执行驳回裁决", "Finalize rejection"],
};

const AUTO_MAPPING_REFRESH_ATTEMPTS = 45;
const AUTO_MAPPING_REFRESH_INTERVAL_MS = 2_000;

function claimBundleFingerprint(bundle: ClaimBundle) {
  return JSON.stringify(bundle);
}

export function ProtocolV3Workbench() {
  const { text } = useLocale();
  const wallet = useAleoWallet();
  const [capability, setCapability] =
    useState<ProtocolV3Capability>(PROTOCOL_V3_CAPABILITY);
  const [capabilityChecked, setCapabilityChecked] = useState(false);
  const [claimHash, setClaimHash] = useState("");
  const [bundle, setBundle] = useState<ClaimBundle | null>(null);
  const [fee, setFee] = useState("1000000");
  const [commitment, setCommitment] = useState("");
  const [marker, setMarker] = useState("");
  const [amount, setAmount] = useState("");
  const [verdict, setVerdict] = useState<0 | 1 | 2 | 3>(0);
  const [disputeType, setDisputeType] =
    useState<ProtocolV3DisputeType>(PROTOCOL_V3_DISPUTE_TYPES.Rejection);
  const [selectedSeverity, setSelectedSeverity] = useState<1 | 2 | 3>(2);
  const [pendingPreview, setPendingPreview] =
    useState<ProtocolV3TransactionPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoRefreshedProtocolTransactionId = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/aleo/v3", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as {
          protocolV3?: ProtocolV3Capability;
        } | null;
        if (payload?.protocolV3) {
          setCapability(payload.protocolV3);
        } else {
          setCapability({
            ...PROTOCOL_V3_CAPABILITY,
            status: response.ok ? "ConfigurationError" : "EndpointUnavailable",
            currentEdition: null,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCapability({
            ...PROTOCOL_V3_CAPABILITY,
            status: "EndpointUnavailable",
            currentEdition: null,
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCapabilityChecked(true);
      });
    return () => controller.abort();
  }, []);

  const lookupClaim = useCallback(async (options: LookupClaimOptions = {}) => {
    const background = options.background === true;
    const normalized = claimHash.trim();
    if (!/^[0-9]+field$/.test(normalized)) {
      if (!background) {
        setMessage(text("请输入有效的 Claim Hash（field）。", "Enter a valid Claim Hash (field)."));
      }
      return null;
    }
    if (!background) {
      setBusy(true);
      setMessage(null);
      setPendingPreview(null);
    }
    try {
      const response = await fetch(
        "/api/aleo/v3/claims/" + encodeURIComponent(normalized),
        { method: "GET", headers: { accept: "application/json" }, cache: "no-store" },
      );
      const payload = await response.json().catch(() => null) as
        | ClaimBundle
        | { error?: string; capability?: string }
        | null;
      if (!response.ok || !payload || !("state" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Protocol-v3 Claim could not be read",
        );
      }
      if (!background) {
        setBundle(payload);
        setAmount(rewardForDecision(payload.bounty, payload.receipt, payload.projectDecision));
        setMessage(text("已读取并严格解析 V3 公共状态。", "Strictly parsed Protocol-v3 public state."));
      }
      return payload;
    } catch (error) {
      if (!background) {
        setBundle(null);
        setMessage(error instanceof Error ? error.message : text("读取失败。", "Lookup failed."));
      }
      return null;
    } finally {
      if (!background) setBusy(false);
    }
  }, [claimHash, text]);

  useEffect(() => {
    const result = wallet.lastPublicTransactionResult;
    const submission = wallet.protocolSubmission;
    if (
      !result ||
      (result.state !== "confirmed" && result.state !== "rejected" && result.state !== "timeout") ||
      !submission ||
      submission.publicTransactionId !== result.publicTransactionId ||
      !bundle ||
      submission.bountyId !== bundle.bounty.bountyId ||
      (submission.claimHash !== null && submission.claimHash !== bundle.receipt.claimHash) ||
      autoRefreshedProtocolTransactionId.current === result.publicTransactionId
    ) {
      return;
    }
    const controller = new AbortController();
    const startingFingerprint = claimBundleFingerprint(bundle);
    const attemptLimit = result.state === "rejected" ? 1 : AUTO_MAPPING_REFRESH_ATTEMPTS;
    setMessage(text(
      result.state === "confirmed"
        ? "公开交易已 Confirmed，正在等待并自动同步 V3 Mapping。"
        : result.state === "rejected"
          ? "公开交易已被拒绝，正在自动重新读取 V3 Mapping 以恢复准确状态。"
          : "钱包尚未收到最终交易结果；正在通过 V3 Mapping 自动检查实际链上状态。",
      result.state === "confirmed"
        ? "The public transaction is confirmed. Waiting for and syncing Protocol-v3 mappings automatically."
        : result.state === "rejected"
          ? "The public transaction was rejected. Refreshing Protocol-v3 mappings to restore the accurate state."
          : "The wallet has not received a final transaction result. Checking Protocol-v3 mappings for the actual on-chain state.",
    ));

    void (async () => {
      for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
        const updated = await lookupClaim({ background: true });
        if (controller.signal.aborted) return;
        if (updated && claimBundleFingerprint(updated) !== startingFingerprint) {
          autoRefreshedProtocolTransactionId.current = result.publicTransactionId;
          setBundle(updated);
          setAmount(rewardForDecision(updated.bounty, updated.receipt, updated.projectDecision));
          setPendingPreview(null);
          setMessage(text(
            "链上 Mapping 已自动同步，页面已进入下一状态。",
            "The on-chain Mapping is synchronized. The page has advanced to the next state.",
          ));
          return;
        }
        if (attempt + 1 < attemptLimit) {
          await new Promise<void>((resolve) => {
            const timeoutId = window.setTimeout(resolve, AUTO_MAPPING_REFRESH_INTERVAL_MS);
            controller.signal.addEventListener("abort", () => {
              window.clearTimeout(timeoutId);
              resolve();
            }, { once: true });
          });
        }
        if (controller.signal.aborted) return;
      }
      autoRefreshedProtocolTransactionId.current = result.publicTransactionId;
      setMessage(text(
        result.state === "rejected"
          ? "交易未被链上接受；页面已保持当前已验证状态。"
          : "交易结果已收到，但 V3 Mapping 尚未索引出状态变化；系统已自动轮询 90 秒，可稍后再次读取。",
        result.state === "rejected"
          ? "The transaction was not accepted on-chain. The page remains on the current verified state."
          : "A transaction result was received, but the V3 Mapping has not indexed a state change. The page polled automatically for 90 seconds; try reading again shortly.",
      ));
    })();

    return () => controller.abort();
  }, [bundle, lookupClaim, text, wallet.lastPublicTransactionResult, wallet.protocolSubmission]);

  const roles = useMemo(() => {
    const address = wallet.address;
    if (!address || !bundle) return [] as string[];
    const result: string[] = [];
    if (address === bundle.bounty.owner) result.push(text("项目方", "Project Owner"));
    if (address === bundle.state.whitehatAddress) result.push(text("白帽", "Whitehat"));
    if (bundle.policy.arbiters.includes(address)) result.push(text("仲裁员", "Panel member"));
    return result;
  }, [bundle, text, wallet.address]);

  const actions = useMemo(
    () => availableActions(bundle, wallet.address),
    [bundle, wallet.address],
  );

  function prepare(action: ActionId, actionCommitmentOverride?: string) {
    if (!bundle) return;
    try {
      const actionCommitment = actionCommitmentOverride ?? commitment;
      const feeMicrocredits = Number(fee);
      const common = {
        bountyId: bundle.bounty.bountyId,
        claimHash: bundle.receipt.claimHash,
        feeMicrocredits,
      };
      let preview: ProtocolV3TransactionPreview;
      switch (action) {
        case "begin-review":
        case "accept-claim":
        case "reject-claim":
        case "mark-duplicate":
        case "mark-scope":
        case "assess-severity": {
          const reviewAction =
            action === "begin-review" ? 1 :
            action === "accept-claim" ? 2 :
            action === "reject-claim" ? 3 :
            action === "mark-duplicate" ? 4 :
            action === "mark-scope" ? 5 : 6;
          const projectSeverity =
            reviewAction === 2 ? receiptSeverityCode(bundle.receipt.severity) :
            reviewAction === 6 ? selectedSeverity : 0;
          preview = buildReviewClaimV3Transaction({
            ...common,
            action: reviewAction,
            projectSeverity,
            decisionCommitment: actionCommitment,
            actionMarker: marker,
          });
          break;
        }
        case "lock-reward":
          preview = buildLockRewardV3Transaction({
            ...common,
            rewardAmount: amount,
            lockMarker: marker,
          });
          break;
        case "deliver-disclosure":
        case "acknowledge-disclosure":
          preview = buildDisclosureActionV3Transaction({
            ...common,
            action: action === "deliver-disclosure" ? 1 : 2,
            // Delivery is bound to the report commitment from the submitted
            // receipt; acknowledgement remains a separate owner commitment.
            actionCommitment: action === "deliver-disclosure"
              ? bundle.evidence.reportCommitment
              : actionCommitment,
            actionMarker: marker,
          });
          break;
        case "confirm-reproduction":
        case "reject-reproduction":
        case "propose-patch":
        case "accept-patch":
        case "finalize-unappealed":
          preview = buildResolutionActionV3Transaction({
            ...common,
            action:
              action === "confirm-reproduction" ? 1 :
              action === "reject-reproduction" ? 2 :
              action === "propose-patch" ? 3 :
              action === "accept-patch" ? 4 : 5,
            actionCommitment,
            actionMarker: marker,
          });
          break;
        case "open-dispute":
        case "open-sla-timeout":
          preview = buildDisputeClaimV3Transaction({
            ...common,
            disputeType: action === "open-sla-timeout"
              ? PROTOCOL_V3_DISPUTE_TYPES.SlaTimeout
              : disputeType,
            requestedSeverity:
              action === "open-dispute" &&
              disputeType === PROTOCOL_V3_DISPUTE_TYPES.Severity
                ? selectedSeverity
                : 0,
            disputeCommitment: actionCommitment,
            feeAmount: bundle.policy.arbitrationFeeMicrocredits,
            disputeMarker: marker,
          });
          break;
        case "cast-vote":
          preview = buildCastArbitrationVoteV3Transaction({
            ...common,
            verdict,
            voteMarker: marker,
          });
          break;
        case "settle-reward":
          preview = buildSettleRewardV3Transaction({
            ...common,
            whitehatAddress: bundle.state.whitehatAddress,
            rewardAmount: amount,
            bondAmount:
              (bundle.disputeMetadata?.disputeType === "Reproduction" ||
               bundle.disputeMetadata?.disputeType === "SlaTimeout") &&
              bundle.disputeBond?.status === "Pending"
                ? bundle.disputeBond.amount
                : "0",
            verdict,
            marker,
          });
          break;
        case "finalize-prelock":
          preview = buildFinalizeArbitrationPrelockV3Transaction({
            ...common,
            whitehatAddress: bundle.state.whitehatAddress,
            rewardAmount: amount,
            bondAmount: bundle.disputeBond?.amount ?? "0",
            verdict,
            marker,
          });
          break;
        case "finalize-rejection":
          preview = buildFinalizeRejectionV3Transaction({
            ...common,
            bondRecipient:
              bundle.disputeMetadata?.disputeType === "Remediation" && verdict === 0
                ? bundle.state.whitehatAddress
                : bundle.bounty.owner,
            bondAmount: bundle.disputeBond?.amount ?? "0",
            verdict,
            rejectionMarker: marker,
          });
          break;
      }
      setPendingPreview(preview);
      setMessage(text("已生成公开交易预览；请核对后再请求签名。", "Public transaction preview prepared. Review it before signing."));
    } catch (error) {
      setPendingPreview(null);
      setMessage(error instanceof Error ? error.message : text("无法生成交易。", "Could not build transaction."));
    }
  }

  async function submitPreview() {
    if (!pendingPreview) return;
    setBusy(true);
    setMessage(null);
    try {
      await wallet.submitProtocolV3Transaction(pendingPreview);
      setPendingPreview(null);
      setMessage(text("钱包请求已创建；等待公开交易确认后重新读取 Mapping。", "Wallet request created. Re-read mappings after public confirmation."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("钱包请求失败。", "Wallet request failed."));
    } finally {
      setBusy(false);
    }
  }

  function prepareBountyEconomicAction(kind: "fund" | "refund") {
    const bountyId = bundle?.bounty.bountyId;
    if (!bountyId) {
      setMessage(text("请先读取一个 V3 Claim，以确定链上 Bounty。", "Load a Protocol-v3 Claim first to identify its Bounty."));
      return;
    }
    try {
      const input = {
        bountyId,
        amount,
        feeMicrocredits: Number(fee),
      };
      const preview = kind === "fund"
        ? buildFundBountyV3Transaction({ ...input, fundingMarker: marker })
        : buildRefundBountyV3Transaction({ ...input, refundMarker: marker });
      setPendingPreview(preview);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("无法生成交易。", "Could not build transaction."));
    }
  }

  const enabled = capability.status === "Available" &&
    capability.walletRequestEnabled &&
    capability.upgradeEvidenceVerified &&
    capability.programHashVerified;

  return (
    <section className="surface-card-strong rounded-lg p-5 sm:p-6" aria-labelledby="v3-workbench-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="page-kicker text-cyan-200">Protocol V3 workbench</p>
          <h2 id="v3-workbench-title" className="mt-2 text-xl font-semibold text-white">
            {text("项目方 · 白帽 · 仲裁面板", "Owner · Whitehat · Arbitration panel")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {text(
              "权限取自已连接钱包与链上不可变配置。页面只读取公开承诺和状态；解密报告、复现材料及利用细节不得粘贴到这里。",
              "Authority comes from the connected wallet and immutable on-chain config. This page reads public commitments and state only; decrypted reports, reproduction artifacts, and exploit details must never be pasted here.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs">
          <span className={enabled ? "text-emerald-200" : "text-amber-200"}>
            {capabilityChecked
              ? capability.status
              : text("核验中", "Checking")}
          </span>
          <span className="text-slate-500">
            Edition {capability.currentEdition ?? "—"} / {capability.requiredEdition}
          </span>
        </div>
      </div>

      {!enabled ? (
        <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100/80">
          {capability.status === "DeploymentEvidencePending"
            ? text(
                "链上已出现所需 Edition，但仓库尚未同时记录并验证升级交易、费用交易与完整 Program 哈希；V3 钱包操作继续关闭。",
                "The required Edition is visible, but the repository has not verified the upgrade transaction, fee transaction, and complete Program hash together. V3 wallet actions remain disabled.",
              )
            : text(
                "当前 Aleo 测试网仍未满足 V3 启用条件。界面不会用本地状态或 Demo 回退替代链上能力。",
                "Aleo Testnet does not yet satisfy the V3 activation requirements. The UI does not substitute local state or a Demo fallback.",
              )}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <FieldInput
          label={text("Claim Hash", "Claim Hash")}
          value={claimHash}
          onChange={setClaimHash}
          placeholder="123...field"
        />
        <button
          className="secondary-action self-end"
          type="button"
          disabled={!enabled || busy}
          onClick={() => void lookupClaim()}
        >
          <Search size={16} aria-hidden="true" />
          {text("读取 V3 状态", "Read V3 state")}
        </button>
      </div>

      {bundle ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PublicField label={text("状态", "State")} value={bundle.state.status} />
            <PublicField label={text("白帽地址", "Whitehat")} value={bundle.state.whitehatAddress} />
            <PublicField label={text("仲裁面板", "Panel")} value={bundle.policy.panelId} />
            <PublicField
              label={text("当前钱包角色", "Connected role")}
              value={roles.length ? roles.join(" / ") : text("只读公开用户", "Read-only public user")}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="rounded-md border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-cyan-200" size={17} aria-hidden="true" />
                <h3 className="text-sm font-semibold text-white">
                  {text("公开证据边界", "Public evidence boundary")}
                </h3>
              </div>
              <div className="mt-4 grid gap-3">
                <PublicField label={text("目标系统承诺", "Target system")} value={bundle.evidence.targetSystemCommitment} />
                <PublicField label={text("代码版本哈希", "Code hash")} value={bundle.evidence.targetCodeHash} />
                <PublicField label={text("执行承诺", "Execution commitment")} value={bundle.evidence.executionCommitment} />
                <PublicField label={text("报告承诺", "Report commitment")} value={bundle.evidence.reportCommitment} />
              </div>
            </div>

            <div className="rounded-md border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2">
                <UserRoundCheck className="text-emerald-200" size={17} aria-hidden="true" />
                <h3 className="text-sm font-semibold text-white">
                  {text("角色允许的下一步", "Role-authorized next steps")}
                </h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FieldInput
                  label={text("动作承诺 / 决策哈希", "Action / decision commitment")}
                  value={commitment}
                  onChange={setCommitment}
                  placeholder="456...field"
                />
                <FieldInput
                  label={text("唯一动作种子", "Unique action seed")}
                  value={marker}
                  onChange={setMarker}
                  placeholder="789...field"
                />
                <FieldInput
                  label={text("奖励 / 资金（microcredits）", "Reward / funds (microcredits)")}
                  value={amount}
                  onChange={setAmount}
                  placeholder="1000000"
                />
                <FieldInput
                  label={text("交易费（microcredits）", "Transaction fee (microcredits)")}
                  value={fee}
                  onChange={setFee}
                  placeholder="1000000"
                />
                <label className="grid gap-2 text-xs text-slate-400">
                  {text("仲裁结论", "Arbitration verdict")}
                  <select
                    className="input-surface focus-ring min-h-11 rounded-md px-3 text-sm"
                    value={verdict}
                    onChange={(event) => setVerdict(Number(event.target.value) as 0 | 1 | 2 | 3)}
                  >
                    <option value={0}>{text("驳回 / 无争议原等级", "Reject / uncontested original tier")}</option>
                    <option value={1}>{text("中危", "Medium")}</option>
                    <option value={2}>{text("高危", "High")}</option>
                    <option value={3}>{text("严重", "Critical")}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-xs text-slate-400">
                  {text("争议类型", "Dispute type")}
                  <select
                    className="input-surface focus-ring min-h-11 rounded-md px-3 text-sm"
                    value={disputeType}
                    onChange={(event) => setDisputeType(Number(event.target.value) as ProtocolV3DisputeType)}
                  >
                    <option value={PROTOCOL_V3_DISPUTE_TYPES.Rejection}>{text("拒绝争议", "Rejection dispute")}</option>
                    <option value={PROTOCOL_V3_DISPUTE_TYPES.Duplicate}>{text("重复报告争议", "Duplicate dispute")}</option>
                    <option value={PROTOCOL_V3_DISPUTE_TYPES.Scope}>{text("范围争议", "Scope dispute")}</option>
                    <option value={PROTOCOL_V3_DISPUTE_TYPES.Severity}>{text("严重程度争议", "Severity dispute")}</option>
                    <option value={PROTOCOL_V3_DISPUTE_TYPES.Reproduction}>{text("复现争议", "Reproduction dispute")}</option>
                    <option value={PROTOCOL_V3_DISPUTE_TYPES.Remediation}>{text("修复争议", "Remediation dispute")}</option>
                    <option value={PROTOCOL_V3_DISPUTE_TYPES.SlaTimeout}>{text("SLA 超时争议", "SLA timeout")}</option>
                  </select>
                </label>
                <label className="grid gap-2 text-xs text-slate-400">
                  {text("项目方 / 请求严重程度", "Project / requested severity")}
                  <select
                    className="input-surface focus-ring min-h-11 rounded-md px-3 text-sm"
                    value={selectedSeverity}
                    onChange={(event) => setSelectedSeverity(Number(event.target.value) as 1 | 2 | 3)}
                  >
                    <option value={1}>{text("中危", "Medium")}</option>
                    <option value={2}>{text("高危", "High")}</option>
                    <option value={3}>{text("严重", "Critical")}</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {wallet.connectionState !== "Connected" ? (
                  <button className="primary-action" type="button" onClick={() => void wallet.connect()}>
                    <WalletCards size={16} aria-hidden="true" />
                    {text("连接 Shield", "Connect Shield")}
                  </button>
                ) : null}
                {actions.map((action) => (
                  <button
                    className={action === "settle-reward" ? "primary-action" : "secondary-action"}
                    type="button"
                    key={action}
                    disabled={!enabled || busy || wallet.transactionSubmissionBlocked}
                    onClick={() => prepare(action)}
                  >
                    {action === "cast-vote" ? <Gavel size={15} aria-hidden="true" /> : null}
                    {text(...actionLabels[action])}
                  </button>
                ))}
                {wallet.address === bundle.bounty.owner ? (
                  <>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={!enabled || busy}
                      onClick={() => prepareBountyEconomicAction("fund")}
                    >
                      {text("追加托管资金", "Fund escrow")}
                    </button>
                    <button
                      className="secondary-action"
                      type="button"
                      disabled={!enabled || busy}
                      onClick={() => prepareBountyEconomicAction("refund")}
                    >
                      {text("到期退款", "Refund expired Bounty")}
                    </button>
                  </>
                ) : null}
                <button className="secondary-action" type="button" onClick={() => void lookupClaim()} disabled={busy || !enabled}>
                  <RefreshCw size={15} aria-hidden="true" />
                  {text("刷新", "Refresh")}
                </button>
              </div>
            </div>
          </div>

          <ProtocolV3SecureDelivery
            claimHash={bundle.receipt.claimHash}
            disclosureKeyCommitment={bundle.policy.disclosureKeyCommitment}
            reportCommitment={bundle.evidence.reportCommitment}
            disputeCommitment={bundle.disputeMetadata?.status === "Open"
              ? bundle.disputeMetadata.disputeCommitment
              : null}
            state={bundle.state.status}
            ownerAddress={bundle.bounty.owner}
            whitehatAddress={bundle.state.whitehatAddress}
            arbiters={bundle.policy.arbiters}
            connectedAddress={wallet.address}
            onPrepareDelivery={() => prepare("deliver-disclosure")}
            onPrepareAcknowledgement={() => prepare("acknowledge-disclosure", bundle.evidence.reportCommitment)}
          />

          {bundle.tally ? (
            <div className="mt-4 grid gap-3 rounded-md border border-violet-300/20 bg-violet-300/[0.05] p-4 sm:grid-cols-4">
              <PublicField label={text("驳回票", "Reject")} value={String(bundle.tally.rejectVotes)} />
              <PublicField label={text("中危票", "Medium")} value={String(bundle.tally.mediumVotes)} />
              <PublicField label={text("高危票", "High")} value={String(bundle.tally.highVotes)} />
              <PublicField label={text("严重票", "Critical")} value={String(bundle.tally.criticalVotes)} />
            </div>
          ) : null}
        </>
      ) : null}

      {pendingPreview ? (
        <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <PublicField label={text("函数", "Function")} value={pendingPreview.functionName} />
            <PublicField label={text("网络", "Network")} value={pendingPreview.network} />
            <PublicField label={text("费用", "Fee")} value={String(pendingPreview.feeMicrocredits)} />
          </div>
          <details className="mt-4 border-t border-white/10 pt-3">
            <summary className="focus-ring cursor-pointer text-xs font-semibold text-slate-400">
              {text("核对公开 ABI 输入", "Review public ABI inputs")}
            </summary>
            <ol className="mt-3 grid gap-2 font-mono text-xs text-slate-400">
              {pendingPreview.inputs.map((input, index) => (
                <li className="break-all" key={index}>
                  {index + 1}. {input}
                </li>
              ))}
            </ol>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="primary-action"
              type="button"
              disabled={!enabled || busy || wallet.transactionSubmissionBlocked}
              onClick={() => void submitPreview()}
            >
              <WalletCards size={16} aria-hidden="true" />
              {text("请求钱包签名", "Request wallet signature")}
            </button>
            <button className="secondary-action" type="button" onClick={() => setPendingPreview(null)}>
              {text("取消", "Cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm leading-6 text-slate-400">{message}</p> : null}
      {wallet.protocolSubmission ? (
        <p className="mt-3 break-all font-mono text-xs text-slate-500">
          {wallet.protocolSubmission.functionName} · {wallet.protocolSubmission.walletRequestId}
        </p>
      ) : null}
    </section>
  );
}

function availableActions(bundle: ClaimBundle | null, address: string | null): ActionId[] {
  if (!bundle || !address) return [];
  const status = bundle.state.status;
  const owner = address === bundle.bounty.owner;
  const whitehat = address === bundle.state.whitehatAddress;
  const panel = bundle.policy.arbiters.includes(address);
  const decision = bundle.projectDecision?.decision;
  const dispute = bundle.disputeMetadata;
  const result: ActionId[] = [];

  if (owner) {
    if (status === "Submitted") {
      result.push(
        "begin-review",
        "accept-claim",
        "reject-claim",
        "mark-duplicate",
        "mark-scope",
        "assess-severity",
      );
    }
    if (status === "OwnerReviewing") {
      result.push(
        "accept-claim",
        "reject-claim",
        "mark-duplicate",
        "mark-scope",
        "assess-severity",
      );
    }
    if (status === "Accepted") result.push("lock-reward", "reject-claim", "mark-duplicate", "mark-scope");
    if (status === "DisclosureAcknowledged") {
      result.push("confirm-reproduction", "reject-reproduction");
    }
    if (status === "ReproductionConfirmed") result.push("propose-patch", "settle-reward");
    if (status === "PatchProposed" && bundle.policy.paymentCondition === "OnReproduction") {
      result.push("settle-reward");
    }
    if (status === "PatchProposed" && decision === "RemediationProposed") {
      result.push("open-dispute");
    }
    if (status === "PatchAccepted") result.push("settle-reward");
    if (status === "RewardLocked") result.push("open-sla-timeout");
  }

  if (whitehat) {
    if (status === "PatchProposed") result.push("accept-patch");
    const appealableDecision =
      decision === "Rejection" ||
      decision === "Duplicate" ||
      decision === "OutOfScope" ||
      decision === "Severity" ||
      decision === "CannotReproduce";
    if (appealableDecision) result.push("open-dispute");
    if (
      status === "ReproductionRejected" ||
      status === "OwnerRejected"
    ) {
      result.push("finalize-unappealed");
    }
    if (
      status === "Submitted" ||
      status === "OwnerReviewing" ||
      status === "Accepted" ||
      status === "DisclosureDelivered" ||
      status === "DisclosureAcknowledged" ||
      status === "ReproductionConfirmed" ||
      status === "PatchAccepted"
    ) {
      result.push("open-sla-timeout");
    }
  }

  if (panel && status === "Disputed") result.push("cast-vote");
  if (status === "Disputed" && dispute) {
    if (!bundle.payout && (
      dispute.disputeType === "Rejection" ||
      dispute.disputeType === "Duplicate" ||
      dispute.disputeType === "Scope" ||
      dispute.disputeType === "Severity"
    )) {
      result.push("finalize-prelock");
    }
    if (bundle.payout && dispute.disputeType === "Reproduction" &&
        bundle.policy.paymentCondition === "OnPatchAcceptance" && owner) {
      result.push("confirm-reproduction");
    }
    if (bundle.payout && dispute.disputeType === "Reproduction" &&
        bundle.policy.paymentCondition !== "OnPatchAcceptance") {
      result.push("settle-reward");
    }
    result.push("finalize-rejection");
  }
  return [...new Set(result)];
}

function receiptSeverityCode(severity: OnChainClaimReceipt["severity"]): 1 | 2 | 3 {
  return severity === "Critical" ? 3 : severity === "High" ? 2 : 1;
}

function rewardForDecision(
  bounty: OnChainBountyState,
  receipt: OnChainClaimReceipt,
  decision: OnChainClaimV3ProjectDecision | null,
) {
  const severity = decision?.decision === "Severity" && decision.projectSeverityCode > 0
    ? decision.projectSeverityCode
    : receiptSeverityCode(receipt.severity);
  return severity === 3
    ? bounty.rewards.critical
    : severity === 2
      ? bounty.rewards.high
      : bounty.rewards.medium;
}

function PublicField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-sm text-slate-200">{value}</p>
    </div>
  );
}

function FieldInput({
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
        className="input-surface focus-ring min-h-11 rounded-md px-3 font-mono text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}
