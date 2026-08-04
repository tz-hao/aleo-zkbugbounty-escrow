"use client";

import { CircleHelp, ExternalLink, LoaderCircle, Unplug, WalletCards } from "lucide-react";

import { useAleoWallet } from "./aleo-wallet-provider";

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
  const busy = connectionState === "Initializing" || connectionState === "Connecting";
  const diagnosticText =
    address && connectionState === "Connected"
      ? `Wallet adapter detected · Connected address ${shortAddress(address)} · Wallet network testnetbeta · Expected network testnetbeta`
      : connectionState === "NotInstalled"
        ? "Wallet extension unavailable · Expected network Aleo Testnet / testnetbeta"
        : errorMessage
          ? "Connection rejected / Wallet locked / Wrong network diagnostics shown below"
          : "Wallet adapter detection pending · Expected network Aleo Testnet / testnetbeta";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" aria-live="polite">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {address && connectionState === "Connected" ? (
          <>
            <span
              className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.075] px-3 font-mono text-xs text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              title={address}
            >
              <WalletCards size={15} aria-hidden="true" />
              <span className="truncate">{shortAddress(address)}</span>
              <span className="hidden font-sans text-xs font-semibold text-emerald-200/75 sm:inline">
                Aleo Testnet
              </span>
            </span>
            <button
              className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-400 transition hover:border-white/20 hover:text-white"
              type="button"
              onClick={() => void disconnect()}
              aria-label="断开 Leo Wallet"
              title="断开 Leo Wallet"
            >
              <Unplug size={16} aria-hidden="true" />
            </button>
          </>
        ) : connectionState === "NotInstalled" ? (
          <a
            className="focus-ring secondary-action min-h-10 flex-1 py-2 sm:flex-none"
            href="https://leo.app/"
            target="_blank"
            rel="noreferrer"
          >
            安装 Leo Wallet
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : (
          <button
            className="focus-ring wallet-connect-action inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:cursor-wait disabled:text-slate-500 sm:flex-none"
            type="button"
            disabled={busy}
            onClick={() => void connect()}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
            ) : (
              <WalletCards size={15} aria-hidden="true" />
            )}
            {connectionState === "Connecting" ? "等待 Wallet" : "连接 Leo Wallet"}
          </button>
        )}
      </div>
      <details className="group relative shrink-0">
        <summary
          className={`focus-ring flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border [&::-webkit-details-marker]:hidden ${
            errorMessage
              ? "border-red-300/25 bg-red-300/10 text-red-100"
              : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
          }`}
          title="Wallet 状态详情"
        >
          <CircleHelp size={16} aria-hidden="true" />
          <span className="sr-only">展开 Wallet 状态详情</span>
        </summary>
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[#090b10]/95 p-3 text-xs leading-5 text-slate-300 shadow-2xl backdrop-blur-xl">
          <p className="font-semibold text-white">Leo Wallet 诊断</p>
          <p className="mt-1 break-words text-slate-400">{diagnosticText}</p>
          {errorMessage ? (
            <p className="mt-2 border-t border-white/10 pt-2 text-red-200">{errorMessage}</p>
          ) : null}
          <p className="mt-2 border-t border-white/10 pt-2 text-slate-500">
            Expected network: Aleo Testnet / testnetbeta
          </p>
          {transactionStatus.state !== "idle" ? (
            <p className="mt-2 border-t border-white/10 pt-2 text-slate-400">
              Transaction: {transactionStatus.code} · {transactionStatus.message}
              {transactionSubmissionBlocked ? " Do not resubmit while pending." : ""}
            </p>
          ) : null}
          {pendingPublicTransactionId ? (
            <p className="mt-2 break-all border-t border-white/10 pt-2 font-mono text-xs text-slate-500">
              Public transaction: {pendingPublicTransactionId}
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}
