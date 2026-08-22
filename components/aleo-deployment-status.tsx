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

const statusLabels: Record<LiveDeployment["verificationStatus"], string> = {
  verified: "链上已确认",
  program_found_transaction_unavailable: "已找到程序，交易接口暂不可用",
  transaction_found_program_unavailable: "交易已找到，Program 接口暂不可用",
  endpoint_unavailable: "公开节点暂不可用",
  not_deployed: "未部署",
  configuration_error: "配置不一致",
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
      ? statusLabels[liveState.deployment.verificationStatus]
      : liveState.kind === "loading"
        ? "正在核验"
        : "公开节点暂不可用";
  const networkLabel =
    currentEdition !== null
      ? `testnet / edition ${currentEdition}`
      : "testnet / public edition unavailable";
  const escrowLabel =
    currentEdition === null
      ? "Protocol V3: Awaiting public verification"
      : protocolV3Live
        ? "Protocol V3 / Edition 4: Public capability verified"
        : "Protocol V3: Strict public capability verification pending";
  const editionOne =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? liveState.deployment.editionOne
      : undefined;
  const upgradeLabel =
    editionOne?.upgradeStatus === "confirmed"
      ? editionOne.feeIndexStatus === "INDEX_UNAVAILABLE"
        ? "Upgrade confirmed / Fee transaction index unavailable"
        : "Upgrade confirmed / Fee transaction indexed"
      : "Upgrade: public verification pending";
  const keyCountLabel =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? String(liveState.deployment.verifyingKeyCount ?? "unknown")
      : "unknown";
  const liveSourceLabel =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? `Program ${liveState.deployment.programFound ? "found" : "unavailable"} / Transaction ${
          liveState.deployment.transactionFound ? "found" : "unavailable"
        }`
      : liveState.kind === "loading"
        ? "checking"
        : "unavailable";

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
            <p className="page-kicker">{text("部署核验", "Deployment verification")}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {confirmed
                ? protocolV3Live
                  ? text("Protocol V3 已上线并完成链上核验", "Protocol V3 is live and verified on-chain")
                  : text("程序与部署交易已完成链上核验", "Program and deployment transaction are verified on-chain")
                : partial
                  ? text("已找到程序，部分接口不可用", "Program found; some endpoints are unavailable")
                  : text("等待公开节点返回部署证据", "Waiting for public-node deployment evidence")}
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
        <DeploymentField label={text("网络", "Network")} value={networkLabel} />
        <DeploymentField label={text("程序编号", "Program ID")} value={ALEO_TESTNET_DEPLOYMENT.programId} mono />
      </div>
      <details className="group mt-4 border-t border-white/10 pt-3">
        <summary className="focus-ring min-h-11 cursor-pointer list-none py-2 text-xs font-semibold text-slate-400 hover:text-white [&::-webkit-details-marker]:hidden">
          {text("查看部署证据与区块浏览器链接", "View deployment evidence and Explorer links")}
        </summary>
        <div className="grid gap-4 pt-2">
          <DeploymentField
            label={text("核验状态", "Verification")}
            value={`${liveSourceLabel} / keys ${keyCountLabel}`}
            mono
          />
          <DeploymentField label={text("托管状态", "Escrow status")} value={escrowLabel} />
          <DeploymentField label={text("Edition 1 历史升级", "Edition 1 historical upgrade")} value={upgradeLabel} />
          <div className="flex flex-wrap gap-2">
          <a
            className="focus-ring secondary-action"
            href={ALEO_TESTNET_DEPLOYMENT.programExplorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            {text("查看程序", "View Program")}
            <ExternalLink size={15} aria-hidden="true" />
          </a>
          <a
            className="focus-ring secondary-action"
            href={ALEO_TESTNET_DEPLOYMENT.transactionExplorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            {text("部署交易", "Deployment transaction")}
            <ExternalLink size={15} aria-hidden="true" />
          </a>          <a
            className="focus-ring secondary-action"
            href={ALEO_TESTNET_EDITION_ONE_UPGRADE.transactionExplorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            Edition 1 History
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
