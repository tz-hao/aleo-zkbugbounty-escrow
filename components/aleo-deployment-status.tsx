"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Radio, ShieldCheck } from "lucide-react";

import { ALEO_TESTNET_DEPLOYMENT } from "@/lib/aleo-program";

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
  verifyingKeyCount: number | null;
  programFound: boolean;
  transactionFound: boolean;
};

type LiveState =
  | { kind: "loading" }
  | { kind: "confirmed"; deployment: LiveDeployment }
  | { kind: "partial"; deployment: LiveDeployment }
  | { kind: "problem"; deployment: LiveDeployment }
  | { kind: "unavailable" };

const statusLabels: Record<LiveDeployment["verificationStatus"], string> = {
  verified: "链上已确认",
  program_found_transaction_unavailable: "Program 已找到，交易接口暂不可用",
  transaction_found_program_unavailable: "交易已找到，Program 接口暂不可用",
  endpoint_unavailable: "公开节点暂不可用",
  not_deployed: "未部署",
  configuration_error: "配置不一致",
};

export function AleoDeploymentStatus() {
  const [liveState, setLiveState] = useState<LiveState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/aleo/deployment", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { deployment?: LiveDeployment };
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
  const statusLabel =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? statusLabels[liveState.deployment.verificationStatus]
      : liveState.kind === "loading"
        ? "正在核验"
        : "公开节点暂不可用";
  const networkLabel =
    liveState.kind === "confirmed" || liveState.kind === "partial" || liveState.kind === "problem"
      ? `testnet / edition ${liveState.deployment.edition ?? "unknown"}`
      : "testnet / edition 0";
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
    <section className="surface-card-strong rounded-lg p-5 sm:p-6" aria-live="polite">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
            <ShieldCheck size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="page-kicker text-[0.68rem]">Aleo Testnet Deployment</p>
            <h2 className="mt-1 text-lg font-semibold text-white">zkBugBounty Protocol 已部署</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Registry 查询连接真实 Testnet Program；签名与广播仍由用户钱包独立完成。
            </p>
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

      <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
        <DeploymentField label="Network" value={networkLabel} />
        <DeploymentField label="Program ID" value={ALEO_TESTNET_DEPLOYMENT.programId} mono />
        <DeploymentField label="Verification" value={`${liveSourceLabel} / keys ${keyCountLabel}`} mono />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-2">
          <a
            className="focus-ring secondary-action"
            href={ALEO_TESTNET_DEPLOYMENT.programExplorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            查看 Program
            <ExternalLink size={15} aria-hidden="true" />
          </a>
          <a
            className="focus-ring secondary-action"
            href={ALEO_TESTNET_DEPLOYMENT.transactionExplorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            部署交易
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
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
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-1 break-all text-sm text-slate-100 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
