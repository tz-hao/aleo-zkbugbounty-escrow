"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Radio, ShieldCheck } from "lucide-react";

import { ALEO_TESTNET_DEPLOYMENT, ALEO_TESTNET_EDITION_ONE_UPGRADE } from "@/lib/aleo-program";
import type { ProtocolV3Capability } from "@/lib/aleo-protocol-v3";
import { useLocale } from "./locale-provider";

type LiveDeployment = {
  status: "Confirmed" | "Partial" | "Unavailable" | "NotDeployed" | "ConfigurationError";
  verification: "NetworkConfirmed" | "Partial" | "Unavailable" | "NotDeployed" | "ConfigurationError";
  verificationStatus:
    | "verified"
    | "program_found_transaction_unavailable"
    | "transaction_found_program_unavailable"
    | "endpoint_unavailable"
    | "not_deployed"
    | "configuration_error";
  network: "testnet";
  programId: string;
  transactionId: string;
  edition: number | null;
  currentEdition: number | null;
  verifyingKeyCount: number | null;
  programFound: boolean;
  transactionFound: boolean;
  editionOne?: {
    upgradeStatus: "confirmed" | "unavailable" | "invalid";
    feeIndexStatus: "FOUND" | "INDEX_UNAVAILABLE" | "HTTP_ERROR";
  };
};

type LiveState =
  | { kind: "loading" }
  | { kind: "confirmed"; deployment: LiveDeployment }
  | { kind: "partial"; deployment: LiveDeployment }
  | { kind: "problem"; deployment: LiveDeployment }
  | { kind: "unavailable" };

const statusLabels: Record<LiveDeployment["verificationStatus"], { chinese: string; english: string }> = {
  verified: { chinese: "验证通过", english: "Verified" },
  program_found_transaction_unavailable: { chinese: "已找到合约，交易接口暂不可用", english: "Program found; transaction endpoint unavailable" },
  transaction_found_program_unavailable: { chinese: "已找到交易，合约接口暂不可用", english: "Transaction found; Program endpoint unavailable" },
  endpoint_unavailable: { chinese: "公开节点暂不可用", english: "Public node unavailable" },
  not_deployed: { chinese: "尚未部署", english: "Not deployed" },
  configuration_error: { chinese: "配置不一致", english: "Configuration mismatch" },
};

export function AleoDeploymentStatus() {
  const { text } = useLocale();
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });
  const [protocolV3, setProtocolV3] = useState<ProtocolV3Capability | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/aleo/deployment", { cache: "no-store", signal: controller.signal }),
      fetch("/api/aleo/v3", { cache: "no-store", signal: controller.signal }),
    ])
      .then(async ([response, protocolResponse]) => {
        const payload = (await response.json()) as { deployment?: LiveDeployment };
        const protocolPayload = await protocolResponse.json().catch(() => null) as {
          protocolV3?: ProtocolV3Capability;
        } | null;
        if (protocolPayload?.protocolV3) setProtocolV3(protocolPayload.protocolV3);
        if (!payload.deployment) {
          throw new Error("Deployment is not network confirmed");
        }
        if (payload.deployment.verificationStatus === "verified") {
          setLiveState({ kind: "confirmed", deployment: payload.deployment });
          return;
        }
        if (
          payload.deployment.verificationStatus === "program_found_transaction_unavailable" ||
          payload.deployment.verificationStatus === "transaction_found_program_unavailable"
        ) {
          setLiveState({ kind: "partial", deployment: payload.deployment });
          return;
        }
        if (response.ok) {
          setLiveState({ kind: "problem", deployment: payload.deployment });
          return;
        }
        setLiveState({ kind: "unavailable" });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLiveState({ kind: "unavailable" });
      });
    return () => controller.abort();
  }, []);

  const confirmed = liveState.kind === "confirmed";
  const partial = liveState.kind === "partial";
  const currentEdition =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? liveState.deployment.currentEdition ?? liveState.deployment.edition
      : null;
  const protocolV3Live = currentEdition === 4 &&
    protocolV3?.status === "Available" &&
    protocolV3.walletRequestEnabled &&
    protocolV3.upgradeEvidenceVerified &&
    protocolV3.programHashVerified;
  const statusLabel =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? text(
        statusLabels[liveState.deployment.verificationStatus].chinese,
        statusLabels[liveState.deployment.verificationStatus].english,
      )
      : liveState.kind === "loading"
        ? text("节点同步中", "Syncing")
        : text("公开节点暂不可用", "Public node unavailable");
  const networkLabel =
    currentEdition !== null
      ? text(`Aleo Testnet / Edition ${currentEdition}`, `Aleo Testnet / Edition ${currentEdition}`)
      : text("Aleo Testnet（公开版本准备中）", "Aleo Testnet (public edition pending)");
  const escrowLabel =
    currentEdition === null
      ? text("Protocol V3（等待公开节点共识验证）", "Protocol V3 (awaiting public-node consensus verification)")
      : protocolV3Live
        ? text("Protocol V3 / Edition 4（公开能力已验证）", "Protocol V3 / Edition 4 (public capability verified)")
        : text("Protocol V3（等待严格公开能力核验）", "Protocol V3 (strict public capability verification pending)");
  const editionOne =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? liveState.deployment.editionOne
      : undefined;
  const upgradeLabel =
    editionOne?.upgradeStatus === "confirmed"
      ? editionOne.feeIndexStatus === "INDEX_UNAVAILABLE"
        ? text("升级已确认 / 费用交易索引暂不可用", "Upgrade confirmed / fee transaction index unavailable")
        : text("升级已确认 / 费用交易已索引", "Upgrade confirmed / fee transaction indexed")
      : text("待公开验证确认 (Pending Verification)", "Pending public verification");
  const keyCountLabel =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? String(liveState.deployment.verifyingKeyCount ?? "unknown")
      : "unknown";
  const liveSourceLabel =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? text(
        `合约${liveState.deployment.programFound ? "已找到" : "暂不可用"} / 交易${liveState.deployment.transactionFound ? "已找到" : "暂不可用"}`,
        `Program ${liveState.deployment.programFound ? "found" : "unavailable"} / Transaction ${
          liveState.deployment.transactionFound ? "found" : "unavailable"
        }`,
      )
      : liveState.kind === "loading"
        ? text("验证中（正在读取 Verifying Keys）", "Verifying (reading Verifying Keys)")
        : text("暂不可用", "Unavailable");

  return (
    <section className="surface-card h-full rounded-lg p-5" aria-live="polite">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
              confirmed
                ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                : "border-white/10 bg-white/[0.04] text-slate-400"
            }`}
          >
            <ShieldCheck size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="page-kicker">{text("智能合约部署核验", "Smart contract deployment verification")}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {confirmed
                ? protocolV3Live
                  ? text("Protocol V3 已上线并完成链上核验", "Protocol V3 is live and verified on-chain")
                  : text("程序与部署交易已完成链上核验", "Program and deployment transaction are verified on-chain")
                : partial
                  ? text("已找到程序，部分接口不可用", "Program found; some endpoints are unavailable")
                  : text("正在等待公开 RPC 节点同步链上部署证明", "Waiting for public RPC nodes to sync deployment proof")}
            </h2>
          </div>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${
            confirmed
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
              : partial
                ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
              : "border-amber-300/25 bg-amber-300/10 text-amber-100"
          }`}
        >
          <Radio size={13} aria-hidden="true" />
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-[0.7fr_1.3fr]">
        <DeploymentField label={text("运行网络", "Runtime network")} value={networkLabel} />
        <DeploymentField label={text("合约 Program ID", "Contract Program ID")} value={ALEO_TESTNET_DEPLOYMENT.programId} mono />
      </div>
      <details className="group mt-4 border-t border-white/10 pt-3">
        <summary className="focus-ring min-h-11 cursor-pointer list-none py-2 text-xs font-semibold text-slate-400 hover:text-white [&::-webkit-details-marker]:hidden">
          {text("展开查看合约部署详情与链上交易哈希 ▾", "View contract deployment details and on-chain transaction hashes ▾")}
        </summary>
        <div className="grid gap-4 pt-2">
          <DeploymentField
            label={text("核验状态", "Verification status")}
            value={`${liveSourceLabel} / Verifying Keys: ${keyCountLabel}`}
            mono
          />
          <DeploymentField label={text("协议状态", "Protocol status")} value={escrowLabel} />
          <DeploymentField label={text("Edition 1 升级记录", "Edition 1 upgrade record")} value={upgradeLabel} />
          <div className="flex flex-wrap gap-2">
          <a
            className="focus-ring secondary-action"
            href={ALEO_TESTNET_DEPLOYMENT.programExplorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            {text("在浏览器中查看合约", "View Program in Explorer")}
            <ExternalLink size={15} aria-hidden="true" />
          </a>
          <a
            className="focus-ring secondary-action"
            href={ALEO_TESTNET_DEPLOYMENT.transactionExplorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            {text("部署交易哈希", "Deployment Tx")}
            <ExternalLink size={15} aria-hidden="true" />
          </a>          <a
            className="focus-ring secondary-action"
            href={ALEO_TESTNET_EDITION_ONE_UPGRADE.transactionExplorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            {text("Edition 1 历史升级记录", "Edition 1 upgrade history")}
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        </div>
      </details>
    </section>
  );
}

function DeploymentField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 break-all text-sm text-slate-100 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
