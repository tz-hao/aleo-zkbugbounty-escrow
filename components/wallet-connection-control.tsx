"use client";

import { CircleHelp, ExternalLink, LoaderCircle, Unplug, WalletCards } from "lucide-react";

import { getLocalizedTransactionMessage } from "@/lib/i18n/transaction";
import { getLocalizedWalletMessage } from "@/lib/i18n/wallet";
import { useAleoWallet } from "./aleo-wallet-provider";
import { useLocale } from "./locale-provider";

function shortAddress(address: string) {
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

export function WalletConnectionControl() {
  const {
    address,
    connectionState,
    errorMessage,
    transactionStatus,
    transactionSubmissionBlocked,
    pendingPublicTransactionId,
    connect,
    disconnect,
  } = useAleoWallet();
  const { text } = useLocale();
  const busy = connectionState === "Initializing" || connectionState === "Connecting";
  const diagnosticText = address && connectionState === "Connected"
    ? text(
      `Shield 已连接 · 地址 ${shortAddress(address)} · 网络 Aleo Testnet`,
      `Shield connected · Address ${shortAddress(address)} · Network Aleo Testnet`,
    )
    : connectionState === "NotInstalled"
      ? text(
        "未检测到 Shield 扩展 · 预期网络 Aleo 测试网",
        "Shield extension unavailable · Expected network Aleo Testnet",
      )
      : errorMessage
        ? text(
          "连接被拒绝、钱包已锁定或网络错误；详见下方诊断。",
          "Connection rejected / wallet locked / wrong network diagnostics shown below",
        )
        : text(
          "正在检测 Shield 适配器 · 预期网络 Aleo 测试网",
          "Shield adapter detection pending · Expected network Aleo Testnet",
        );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" aria-live="polite">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {address && connectionState === "Connected" ? (
          <>
            <span
              className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-cyan-300/25 bg-gradient-to-r from-cyan-300/[0.09] to-violet-300/[0.07] px-3 font-mono text-xs text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              title={address}
            >
              <WalletCards size={15} aria-hidden="true" />
              <span className="truncate">{shortAddress(address)}</span>
              <span className="hidden font-sans text-xs font-semibold text-cyan-200/75 sm:inline">
                {text("Aleo 测试网", "Aleo Testnet")}
              </span>
            </span>
            <button
              aria-label={text("断开 Shield", "Disconnect Shield")}
              className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-400 transition hover:border-cyan-300/25 hover:text-cyan-50"
              onClick={() => void disconnect()}
              title={text("断开 Shield", "Disconnect Shield")}
              type="button"
            >
              <Unplug size={16} aria-hidden="true" />
            </button>
          </>
        ) : connectionState === "NotInstalled" ? (
          <a
            className="focus-ring secondary-action min-h-10 flex-1 py-2 sm:flex-none"
            href="https://shieldwallet.io/"
            rel="noreferrer"
            target="_blank"
          >
            {text("安装 Shield", "Install Shield")}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : (
          <button
            className="focus-ring wallet-connect-action inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-wait disabled:text-slate-500 sm:flex-none"
            disabled={busy}
            onClick={() => void connect()}
            type="button"
          >
            {busy ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : <WalletCards size={15} aria-hidden="true" />}
            {connectionState === "Connecting"
              ? text("等待 Shield 响应", "Waiting for Shield")
              : text("连接 Shield", "Connect Shield")}
          </button>
        )}
      </div>
      <details className="group relative shrink-0">
        <summary
          className={`focus-ring flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border [&::-webkit-details-marker]:hidden ${
            errorMessage
              ? "border-red-300/25 bg-red-300/10 text-red-100"
              : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-violet-300/25 hover:text-white"
          }`}
          title={text("钱包状态详情", "Wallet status details")}
        >
          <CircleHelp size={16} aria-hidden="true" />
          <span className="sr-only">{text("展开钱包状态详情", "Expand wallet status details")}</span>
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-cyan-300/15 bg-[#070912]/95 p-3 text-xs leading-5 text-slate-300 shadow-2xl backdrop-blur-xl">
          <p className="font-semibold text-white">{text("Shield 诊断", "Shield diagnostics")}</p>
          <p className="mt-1 break-words text-slate-400">{diagnosticText}</p>
          {errorMessage ? (
            <p className="mt-2 border-t border-white/10 pt-2 text-red-200">
              {getLocalizedWalletMessage(errorMessage, text)}
            </p>
          ) : null}
          <p className="mt-2 border-t border-white/10 pt-2 text-slate-500">
            {text("预期网络：Aleo 测试网", "Expected network: Aleo Testnet")}
          </p>
          <p className="mt-2 border-t border-white/10 pt-2 text-slate-500">
            {text("适配器为 alpha 集成；每笔交易都必须在 Shield 内人工核对并签名。", "The adapter is alpha; verify and sign every transaction manually in Shield.")}
          </p>
          {transactionStatus.state !== "idle" ? (
            <p className="mt-2 border-t border-white/10 pt-2 text-slate-400">
              {text("交易", "Transaction")}: {transactionStatus.code} · {getLocalizedTransactionMessage(transactionStatus.state, text)}
              {transactionSubmissionBlocked
                ? text(" 请勿在待处理中重复提交。", " Do not resubmit while pending.")
                : ""}
            </p>
          ) : null}
          {pendingPublicTransactionId ? (
            <p className="mt-2 break-all border-t border-white/10 pt-2 font-mono text-xs text-slate-500">
              {text("公开交易", "Public transaction")}: {pendingPublicTransactionId}
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
