"use client";

import {
  CircleAlert,
  Database,
  EyeOff,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";

import { deriveReporterSecretField } from "@/lib/aleo-submit-claim";
import {
  PROTOCOL_V3_CAPABILITY,
  type ProtocolV3Capability,
} from "@/lib/aleo-protocol-v3";
import type { OnChainBountyV3Config } from "@/lib/aleo-v3-registry";
import type { OnChainBountyState } from "@/lib/models";
import { useAleoWallet } from "./aleo-wallet-provider";
import { useLocale } from "./locale-provider";

type BountyBundle = {
  bounty: OnChainBountyState;
  policy: OnChainBountyV3Config;
  protocolVersion: 3;
};

type WitnessValues = {
  vaultBalanceBefore: string;
  totalDepositsBefore: string;
  totalClaimsBefore: string;
  reservedRewardsBefore: string;
  withdrawLimitBefore: string;
  userBalanceBefore: string;
  requestedWithdrawBefore: string;
  hiddenDeltaBalance: string;
  hiddenDeltaClaims: string;
  hiddenDeltaReservedRewards: string;
  hiddenDeltaWithdrawAmount: string;
  hiddenDeltaUserBalance: string;
};

const initialWitness: WitnessValues = {
  vaultBalanceBefore: "100",
  totalDepositsBefore: "100",
  totalClaimsBefore: "80",
  reservedRewardsBefore: "20",
  withdrawLimitBefore: "50",
  userBalanceBefore: "40",
  requestedWithdrawBefore: "20",
  hiddenDeltaBalance: "90",
  hiddenDeltaClaims: "30",
  hiddenDeltaReservedRewards: "0",
  hiddenDeltaWithdrawAmount: "35",
  hiddenDeltaUserBalance: "10",
};

export function AleoSubmitClaimV3Panel() {
  const { text } = useLocale();
  const wallet = useAleoWallet();
  const [capability, setCapability] =
    useState<ProtocolV3Capability>(PROTOCOL_V3_CAPABILITY);
  const [latestHeight, setLatestHeight] = useState<number | null>(null);
  const [bountyId, setBountyId] = useState("");
  const [bundle, setBundle] = useState<BountyBundle | null>(null);
  const [targetStateCommitment, setTargetStateCommitment] = useState("");
  const [executionCommitment, setExecutionCommitment] = useState("");
  const [reportCommitment, setReportCommitment] = useState("");
  const [reporterSecret, setReporterSecret] = useState("");
  const [witness, setWitness] = useState<WitnessValues>(initialWitness);
  const [fee, setFee] = useState("5000000");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/aleo/v3", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch("/api/aleo/network", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([capabilityResponse, networkResponse]) => {
        const [capabilityPayload, networkPayload] = await Promise.all([
          capabilityResponse.json().catch(() => null) as Promise<{
            protocolV3?: ProtocolV3Capability;
          } | null>,
          networkResponse.json().catch(() => null) as Promise<{
            network?: { status?: string; latestHeight?: number };
          } | null>,
        ]);
        if (capabilityPayload?.protocolV3) {
          setCapability(capabilityPayload.protocolV3);
        }
        const height = networkPayload?.network?.latestHeight;
        if (
          networkResponse.ok &&
          networkPayload?.network?.status === "Available" &&
          Number.isSafeInteger(height)
        ) {
          setLatestHeight(height!);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCapability({
            ...PROTOCOL_V3_CAPABILITY,
            status: "EndpointUnavailable",
            currentEdition: null,
          });
          setLatestHeight(null);
        }
      });
    return () => controller.abort();
  }, []);

  const enabled = capability.status === "Available" &&
    capability.walletRequestEnabled &&
    capability.upgradeEvidenceVerified;

  async function lookupBounty() {
    const normalized = bountyId.trim();
    if (!/^[0-9]+field$/.test(normalized)) {
      setMessage(text("请输入有效的 Bounty ID（field）。", "Enter a valid Bounty ID (field)."));
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        "/api/aleo/v3/bounties/" + encodeURIComponent(normalized),
        { method: "GET", headers: { accept: "application/json" }, cache: "no-store" },
      );
      const payload = await response.json().catch(() => null) as
        | BountyBundle
        | { error?: string }
        | null;
      if (!response.ok || !payload || !("bounty" in payload)) {
        throw new Error(
          payload && "error" in payload && payload.error
            ? payload.error
            : "Protocol-v3 Bounty could not be read",
        );
      }
      setBundle(payload);
      setMessage(text("V3 赏金、目标绑定与仲裁规则已从链上读取。", "Read the V3 Bounty, target bindings, and arbitration policy from chain."));
    } catch (error) {
      setBundle(null);
      setMessage(error instanceof Error ? error.message : text("读取失败。", "Lookup failed."));
    } finally {
      setBusy(false);
    }
  }

  function setWitnessValue(key: keyof WitnessValues, value: string) {
    setWitness((current) => ({ ...current, [key]: value }));
  }

  async function submitClaim() {
    if (!bundle || latestHeight === null) {
      setMessage(text("请先读取有效的 V3 赏金与网络高度。", "Load a valid V3 Bounty and network height first."));
      return;
    }
    if (wallet.connectionState !== "Connected") {
      setMessage(text("请先连接 Shield。", "Connect Shield first."));
      return;
    }
    if (wallet.address === bundle.bounty.owner) {
      setMessage(text("项目方钱包不能向自己的真实 V3 赏金提交 Claim。", "The Owner wallet cannot submit a Claim to its own real V3 Bounty."));
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const reporterSecretField = await deriveReporterSecretField(reporterSecret);
      const transientWitness = { ...witness, reporterSecretField };
      await wallet.submitWalletClaimV3({
        bounty: bundle.bounty,
        latestBlockHeight: latestHeight,
        feeMicrocredits: Number(fee),
        binding: {
          targetSystemCommitment: bundle.policy.targetSystemCommitment,
          targetStateCommitment,
          targetCodeHash: bundle.policy.targetCodeHash,
          executionCommitment,
          reportCommitment,
        },
        witness: transientWitness,
      });
      setMessage(text("钱包已接收 submit_claim_v3；等待公开交易确认和 V3 Mapping 验证。", "Wallet accepted submit_claim_v3. Wait for public confirmation and V3 Mapping verification."));
      setTargetStateCommitment("");
      setExecutionCommitment("");
      setReportCommitment("");
      setWitness(Object.fromEntries(
        Object.keys(initialWitness).map((key) => [key, ""]),
      ) as WitnessValues);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("V3 Claim 请求失败。", "V3 Claim request failed."));
    } finally {
      setReporterSecret("");
      setBusy(false);
    }
  }

  return (
    <section className="surface-card rounded-lg p-5" aria-labelledby="submit-v3-claim-title">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2">
            <Database className="text-violet-200" size={16} aria-hidden="true" />
            <p className="page-kicker text-violet-200">submit_claim_v3</p>
          </div>
          <h2 id="submit-v3-claim-title" className="mt-2 text-lg font-semibold text-white">
            {text("白帽 V3 私有证明与目标绑定", "Whitehat V3 private proof and target binding")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {text(
              "目标系统和代码版本来自链上赏金；白帽补充目标状态、执行和报告承诺。私有 witness 直接交给 Shield，不发送到本站 API。",
              "The target system and code version come from the on-chain Bounty. The Whitehat adds target-state, execution, and report commitments. The private witness goes directly to Shield and is never sent to this site's API.",
            )}
          </p>
        </div>
        <span className={enabled ? "text-sm text-emerald-200" : "text-sm text-amber-200"}>
          {capability.status} · Edition {capability.currentEdition ?? "—"}
        </span>
      </div>

      {!enabled ? (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.05] p-3 text-sm leading-6 text-amber-100/75">
          <CircleAlert className="mt-1 shrink-0" size={16} aria-hidden="true" />
          {text(
            "当前测试网尚未通过 Edition 2 与升级证据核验，V3 Claim 钱包按钮保持关闭。",
            "Testnet has not passed Edition 2 and upgrade-evidence verification. The V3 Claim wallet button remains disabled.",
          )}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <FieldInput label="Bounty ID" value={bountyId} onChange={setBountyId} placeholder="123...field" />
        <button className="secondary-action self-end" type="button" disabled={!enabled || busy} onClick={() => void lookupBounty()}>
          <Search size={16} aria-hidden="true" />
          {text("读取链上 V3 赏金", "Read V3 Bounty")}
        </button>
      </div>

      {bundle ? (
        <>
          <div className="mt-4 grid gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4 sm:grid-cols-2">
            <PublicField label={text("目标系统承诺（固定）", "Target system (fixed)")} value={bundle.policy.targetSystemCommitment} />
            <PublicField label={text("代码版本哈希（固定）", "Code hash (fixed)")} value={bundle.policy.targetCodeHash} />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <FieldInput label={text("目标状态承诺", "Target-state commitment")} value={targetStateCommitment} onChange={setTargetStateCommitment} placeholder="...field" />
            <FieldInput label={text("可验证执行承诺", "Execution commitment")} value={executionCommitment} onChange={setExecutionCommitment} placeholder="...field" />
            <FieldInput label={text("加密报告承诺", "Encrypted report commitment")} value={reportCommitment} onChange={setReportCommitment} placeholder="...field" />
          </div>

          <details className="mt-4 rounded-md border border-white/10 bg-black/20 p-4">
            <summary className="focus-ring cursor-pointer text-sm font-semibold text-white">
              {text("填写本地私有 DemoVault witness", "Enter local private DemoVault witness")}
            </summary>
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-100/70">
              <EyeOff className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
              {text("这些值不会出现在公开预览或 API 中；不要录屏、复制到聊天或浏览器日志。", "These values never appear in public previews or APIs. Do not screen-record or copy them into chat or browser logs.")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(initialWitness) as Array<keyof WitnessValues>).map((key) => (
                <FieldInput
                  key={key}
                  label={key}
                  value={witness[key]}
                  onChange={(value) => setWitnessValue(key, value)}
                  placeholder="0"
                  type="number"
                />
              ))}
              <FieldInput
                label={text("Reporter secret（本地派生 field）", "Reporter secret (locally derived field)")}
                value={reporterSecret}
                onChange={setReporterSecret}
                placeholder={text("仅本地输入", "Local input only")}
                type="password"
              />
              <FieldInput label={text("交易费", "Transaction fee")} value={fee} onChange={setFee} placeholder="5000000" type="number" />
            </div>
          </details>

          <div className="mt-4 flex flex-wrap gap-2">
            {wallet.connectionState !== "Connected" ? (
              <button className="primary-action" type="button" onClick={() => void wallet.connect()}>
                <WalletCards size={16} aria-hidden="true" />
                {text("连接 Shield", "Connect Shield")}
              </button>
            ) : null}
            <button
              className="primary-action"
              type="button"
              disabled={
                !enabled ||
                busy ||
                wallet.connectionState !== "Connected" ||
                wallet.transactionSubmissionBlocked
              }
              onClick={() => void submitClaim()}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              {text("生成证明并请求签名", "Prove and request signature")}
            </button>
          </div>
        </>
      ) : null}

      {message ? <p className="mt-4 text-sm leading-6 text-slate-400">{message}</p> : null}
      {wallet.claimSubmission?.functionName === "submit_claim_v3" ? (
        <p className="mt-3 break-all font-mono text-xs text-slate-500">
          {wallet.claimSubmission.walletRequestId} · {wallet.claimSubmission.statusText}
        </p>
      ) : null}
    </section>
  );
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "number" | "password";
}) {
  return (
    <label className="grid gap-2 text-xs text-slate-400">
      {label}
      <input
        className="input-surface focus-ring min-h-11 rounded-md px-3 font-mono text-sm"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}
