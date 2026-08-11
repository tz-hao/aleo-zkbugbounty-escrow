"use client";

import {
  CircleAlert,
  Hash,
  KeyRound,
  ShieldCheck,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  createScopeFieldHash,
  generateBountyFieldId,
  getRuleFieldLiteral,
} from "@/lib/aleo-create-bounty";
import {
  buildCreateBountyV3Transaction,
  PROTOCOL_V3_CAPABILITY,
  type ProtocolV3Capability,
  type ProtocolV3TransactionPreview,
} from "@/lib/aleo-protocol-v3";
import { DEMO_VAULT_RULES } from "@/lib/demo-vault";
import type { DemoVaultRuleId } from "@/lib/models";
import { useAleoWallet } from "./aleo-wallet-provider";
import { useLocale } from "./locale-provider";

type NetworkState =
  | { kind: "loading" }
  | { kind: "available"; latestHeight: number }
  | { kind: "unavailable" };

export function AleoCreateBountyV3Form() {
  const { copy, text } = useLocale();
  const wallet = useAleoWallet();
  const [network, setNetwork] = useState<NetworkState>({ kind: "loading" });
  const [capability, setCapability] =
    useState<ProtocolV3Capability>(PROTOCOL_V3_CAPABILITY);
  const [scope, setScope] = useState("Vault accounting logic at a pinned target version");
  const [ruleId, setRuleId] = useState<DemoVaultRuleId>("vault-accounting-safety");
  const [bountyId, setBountyId] = useState("");
  const [scopeHash, setScopeHash] = useState("");
  const [criticalReward, setCriticalReward] = useState("5000000");
  const [highReward, setHighReward] = useState("2000000");
  const [mediumReward, setMediumReward] = useState("1000000");
  const [deadlineBlocks, setDeadlineBlocks] = useState("100000");
  const [disclosureKeyCommitment, setDisclosureKeyCommitment] = useState("");
  const [targetSystemCommitment, setTargetSystemCommitment] = useState("");
  const [targetCodeHash, setTargetCodeHash] = useState("");
  const [panelId, setPanelId] = useState("");
  const [arbiterOne, setArbiterOne] = useState("");
  const [arbiterTwo, setArbiterTwo] = useState("");
  const [arbiterThree, setArbiterThree] = useState("");
  const [quorum, setQuorum] = useState<2 | 3>(2);
  const [reviewWindow, setReviewWindow] = useState("10000");
  const [decisionWindow, setDecisionWindow] = useState("20000");
  const [arbitrationFee, setArbitrationFee] = useState("1000000");
  const [paymentCondition, setPaymentCondition] = useState<1 | 2>(1);
  const [fee, setFee] = useState("1000000");
  const [preview, setPreview] = useState<ProtocolV3TransactionPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/aleo/network", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch("/api/aleo/v3", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([networkResponse, capabilityResponse]) => {
        const [networkPayload, capabilityPayload] = await Promise.all([
          networkResponse.json().catch(() => null) as Promise<{
            network?: { status?: string; latestHeight?: number };
          } | null>,
          capabilityResponse.json().catch(() => null) as Promise<{
            protocolV3?: ProtocolV3Capability;
          } | null>,
        ]);
        const latestHeight = networkPayload?.network?.latestHeight;
        setNetwork(
          networkResponse.ok &&
          networkPayload?.network?.status === "Available" &&
          Number.isSafeInteger(latestHeight)
            ? { kind: "available", latestHeight: latestHeight! }
            : { kind: "unavailable" },
        );
        if (capabilityPayload?.protocolV3) {
          setCapability(capabilityPayload.protocolV3);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setNetwork({ kind: "unavailable" });
          setCapability({
            ...PROTOCOL_V3_CAPABILITY,
            status: "EndpointUnavailable",
            currentEdition: null,
          });
        }
      });
    return () => controller.abort();
  }, []);

  const deadlineHeight = useMemo(() => {
    if (network.kind !== "available" || !/^[0-9]+$/.test(deadlineBlocks)) {
      return null;
    }
    const height = network.latestHeight + Number(deadlineBlocks);
    return Number.isSafeInteger(height) ? height : null;
  }, [deadlineBlocks, network]);

  const enabled = capability.status === "Available" &&
    capability.walletRequestEnabled &&
    capability.upgradeEvidenceVerified;

  async function generateIdentifiers() {
    setMessage(null);
    try {
      const nextBountyId = generateBountyFieldId((bytes) => crypto.getRandomValues(bytes));
      const [nextScopeHash, nextPanelId] = await Promise.all([
        createScopeFieldHash(
          scope,
          ruleId,
          (algorithm, data) => crypto.subtle.digest(algorithm, data),
        ),
        createScopeFieldHash(
          `panel:${arbiterOne}:${arbiterTwo}:${arbiterThree}:${quorum}`,
          ruleId,
          (algorithm, data) => crypto.subtle.digest(algorithm, data),
        ),
      ]);
      setBountyId(nextBountyId);
      setScopeHash(nextScopeHash);
      if (arbiterOne && arbiterTwo && arbiterThree) setPanelId(nextPanelId);
      setPreview(null);
    } catch {
      setMessage(text("无法生成公开标识，请检查范围与面板地址。", "Could not generate public identifiers. Check the Scope and panel addresses."));
    }
  }

  function buildPreview() {
    if (network.kind !== "available" || deadlineHeight === null) {
      throw new Error("Aleo Testnet height must be available before creating a V3 Bounty");
    }
    if (
      wallet.address &&
      [arbiterOne, arbiterTwo, arbiterThree].includes(wallet.address)
    ) {
      throw new Error("The Bounty owner cannot also be a member of its arbitration panel");
    }
    return buildCreateBountyV3Transaction({
      bountyId,
      scopeHash,
      ruleId: getRuleFieldLiteral(ruleId),
      criticalReward,
      highReward,
      mediumReward,
      disclosureDeadline: deadlineHeight,
      policy: {
        disclosureKeyCommitment,
        targetSystemCommitment,
        targetCodeHash,
        panelId,
        arbiters: [arbiterOne, arbiterTwo, arbiterThree],
        quorum,
        reviewWindowBlocks: Number(reviewWindow),
        decisionWindowBlocks: Number(decisionWindow),
        arbitrationFeeMicrocredits: arbitrationFee,
        paymentCondition,
      },
      feeMicrocredits: Number(fee),
    });
  }

  function handlePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      setPreview(buildPreview());
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : text("参数无效。", "Invalid parameters."));
    }
  }

  async function requestWallet() {
    setSubmitting(true);
    setMessage(null);
    try {
      const nextPreview = buildPreview();
      setPreview(nextPreview);
      await wallet.submitProtocolV3Transaction(nextPreview);
      setMessage(text("钱包已接收 V3 创建请求；请等待公开交易确认。", "Wallet accepted the V3 creation request. Wait for public transaction confirmation."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text("钱包请求失败。", "Wallet request failed."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="surface-card rounded-lg p-5 sm:p-6" aria-labelledby="create-v3-bounty-title">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-violet-300/25 bg-violet-300/10 px-2 py-1 text-xs font-semibold text-violet-100">
              Protocol V3 · Program Edition 2
            </span>
            <span className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-400">
              {capability.status} · Edition {capability.currentEdition ?? "—"}
            </span>
          </div>
          <h2 id="create-v3-bounty-title" className="mt-3 text-xl font-semibold text-white">
            {text("创建可审核、可仲裁的 V3 赏金", "Create an auditable, arbitrated V3 Bounty")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {text(
              "披露公钥承诺、目标版本和 3 人仲裁面板随赏金固定上链，创建后不可由项目方单方面替换。",
              "The disclosure-key commitment, target version, and three-member panel are fixed with the Bounty and cannot be replaced unilaterally by the Owner.",
            )}
          </p>
        </div>
        <span className={enabled ? "text-sm text-emerald-200" : "text-sm text-amber-200"}>
          {enabled
            ? text("钱包操作已启用", "Wallet actions enabled")
            : text("等待 Edition 2 与公开升级证据", "Waiting for Edition 2 and public upgrade evidence")}
        </span>
      </div>

      <form className="mt-5 grid gap-5" onSubmit={handlePreview}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-300">
            {text("安全规则", "Security rule")}
            <select
              className="input-surface focus-ring min-h-11 rounded-md px-3"
              value={ruleId}
              onChange={(event) => {
                setRuleId(event.target.value as DemoVaultRuleId);
                setScopeHash("");
                setPreview(null);
              }}
            >
              {DEMO_VAULT_RULES.map((rule) => (
                <option key={rule.id} value={rule.id}>{copy.rules[rule.id].name}</option>
              ))}
            </select>
          </label>
          <FormInput label={text("披露截止区块增量", "Disclosure deadline delta")} value={deadlineBlocks} onChange={setDeadlineBlocks} placeholder="100000" />
        </div>

        <label className="grid gap-2 text-sm text-slate-300">
          {text("漏洞范围（仅用于生成公开 Scope Hash）", "Scope (used only for the public Scope Hash)")}
          <textarea
            className="input-surface focus-ring min-h-24 rounded-md px-3 py-3"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
              setScopeHash("");
              setPreview(null);
            }}
          />
          <span className="text-xs leading-5 text-amber-100/70">
            {text("不要填写利用步骤、触发参数、明文报告或私钥。", "Do not enter exploit steps, triggering parameters, plaintext reports, or private keys.")}
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput label={text("严重奖励", "Critical reward")} value={criticalReward} onChange={setCriticalReward} placeholder="5000000" />
          <FormInput label={text("高危奖励", "High reward")} value={highReward} onChange={setHighReward} placeholder="2000000" />
          <FormInput label={text("中危奖励", "Medium reward")} value={mediumReward} onChange={setMediumReward} placeholder="1000000" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <FormInput label={text("披露公钥承诺", "Disclosure key commitment")} value={disclosureKeyCommitment} onChange={setDisclosureKeyCommitment} placeholder="...field" icon={<KeyRound size={15} />} />
          <FormInput label={text("目标系统承诺", "Target system commitment")} value={targetSystemCommitment} onChange={setTargetSystemCommitment} placeholder="...field" icon={<ShieldCheck size={15} />} />
          <FormInput label={text("目标代码版本哈希", "Target code hash")} value={targetCodeHash} onChange={setTargetCodeHash} placeholder="...field" icon={<Hash size={15} />} />
        </div>

        <div className="rounded-md border border-violet-300/20 bg-violet-300/[0.04] p-4">
          <div className="flex items-center gap-2">
            <UsersRound className="text-violet-200" size={17} aria-hidden="true" />
            <h3 className="text-sm font-semibold text-white">{text("不可变仲裁面板", "Immutable arbitration panel")}</h3>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <FormInput label={text("仲裁员 1", "Arbiter 1")} value={arbiterOne} onChange={setArbiterOne} placeholder="aleo1..." />
            <FormInput label={text("仲裁员 2", "Arbiter 2")} value={arbiterTwo} onChange={setArbiterTwo} placeholder="aleo1..." />
            <FormInput label={text("仲裁员 3", "Arbiter 3")} value={arbiterThree} onChange={setArbiterThree} placeholder="aleo1..." />
            <FormInput label={text("面板 ID", "Panel ID")} value={panelId} onChange={setPanelId} placeholder="生成或填写 ...field" />
            <label className="grid gap-2 text-xs text-slate-400">
              {text("门槛", "Quorum")}
              <select
                className="input-surface focus-ring min-h-11 rounded-md px-3 text-sm"
                value={quorum}
                onChange={(event) => setQuorum(Number(event.target.value) as 2 | 3)}
              >
                <option value={2}>2 / 3</option>
                <option value={3}>3 / 3</option>
              </select>
            </label>
            <FormInput label={text("仲裁保证金", "Arbitration bond")} value={arbitrationFee} onChange={setArbitrationFee} placeholder="1000000" />
            <FormInput label={text("审核 SLA（区块）", "Review SLA (blocks)")} value={reviewWindow} onChange={setReviewWindow} placeholder="10000" />
            <FormInput label={text("裁决 SLA（区块）", "Decision SLA (blocks)")} value={decisionWindow} onChange={setDecisionWindow} placeholder="20000" />
            <label className="grid gap-2 text-xs text-slate-400">
              {text("付款条件", "Payment condition")}
              <select
                className="input-surface focus-ring min-h-11 rounded-md px-3 text-sm"
                value={paymentCondition}
                onChange={(event) => setPaymentCondition(Number(event.target.value) as 1 | 2)}
              >
                <option value={1}>{text("确认复现后可付款", "Pay after reproduction")}</option>
                <option value={2}>{text("白帽确认修复后付款", "Pay after patch acceptance")}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormInput label={text("Bounty ID", "Bounty ID")} value={bountyId} onChange={setBountyId} placeholder="...field" />
          <FormInput label={text("Scope Hash", "Scope Hash")} value={scopeHash} onChange={setScopeHash} placeholder="...field" />
          <FormInput label={text("交易费", "Transaction fee")} value={fee} onChange={setFee} placeholder="1000000" />
          <div className="self-end">
            <button className="secondary-action w-full" type="button" onClick={() => void generateIdentifiers()}>
              <Hash size={15} aria-hidden="true" />
              {text("生成公开标识", "Generate public IDs")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="secondary-action" type="submit" disabled={!enabled}>
            {text("生成交易预览", "Build transaction preview")}
          </button>
          {wallet.connectionState !== "Connected" ? (
            <button className="primary-action" type="button" onClick={() => void wallet.connect()}>
              <WalletCards size={16} aria-hidden="true" />
              {text("连接 Leo Wallet", "Connect Leo Wallet")}
            </button>
          ) : null}
          <button
            className="primary-action"
            type="button"
            disabled={
              !enabled ||
              !preview ||
              submitting ||
              wallet.transactionSubmissionBlocked
            }
            onClick={() => void requestWallet()}
          >
            <WalletCards size={16} aria-hidden="true" />
            {text("请求创建签名", "Request creation signature")}
          </button>
        </div>
      </form>

      {!enabled ? (
        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-amber-100/75">
          <CircleAlert className="mt-1 shrink-0" size={16} aria-hidden="true" />
          {text(
            "本地构建器已就绪，但当前测试网能力门未通过；表单不会向旧 Edition 发送 V3 交易。",
            "The local builder is ready, but the Testnet capability gate is not. This form will not send V3 transactions to the old Edition.",
          )}
        </p>
      ) : null}

      {preview ? (
        <details className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
          <summary className="focus-ring cursor-pointer text-sm font-semibold text-cyan-100">
            {text("核对 create_bounty_v3 的 9 个公开输入", "Review the 9 public create_bounty_v3 inputs")}
          </summary>
          <ol className="mt-3 grid gap-2 font-mono text-xs text-slate-400">
            {preview.inputs.map((input, index) => (
              <li className="break-all" key={index}>{index + 1}. {input}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            {text("截止高度", "Deadline height")}: {deadlineHeight ?? "—"}
          </p>
        </details>
      ) : null}

      {message ? <p className="mt-4 text-sm leading-6 text-slate-400">{message}</p> : null}
    </section>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-xs text-slate-400">
      <span className="flex items-center gap-2">{icon}{label}</span>
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
