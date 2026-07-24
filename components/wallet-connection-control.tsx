"use client";

import { ExternalLink, LoaderCircle, Unplug, WalletCards } from "lucide-react";

import { useAleoWallet } from "./aleo-wallet-provider";

function shortAddress(address: string) {
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

export function WalletConnectionControl() {
  const { address, connectionState, errorMessage, connect, disconnect } = useAleoWallet();
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
    <div className="flex min-w-0 flex-col gap-1" aria-live="polite">
      <div className="flex min-w-0 items-center gap-2">
        {address && connectionState === "Connected" ? (
          <>
            <span
              className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-3 font-mono text-xs text-emerald-100"
              title={address}
            >
              <WalletCards size={15} aria-hidden="true" />
              <span className="truncate">{shortAddress(address)}</span>
              <span className="hidden text-[10px] font-sans font-semibold uppercase text-emerald-200/70 sm:inline">
                Testnet
              </span>
            </span>
            <button
              className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:text-white"
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
            className="focus-ring secondary-action min-h-10 py-2"
            href="https://leo.app/"
            target="_blank"
            rel="noreferrer"
          >
            获取 Leo Wallet
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : (
          <button
            className="focus-ring secondary-action min-h-10 py-2 disabled:cursor-wait disabled:text-slate-500"
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
      {errorMessage ? (
        <p className="max-w-80 text-xs leading-5 text-red-200">
          <span className="font-semibold text-red-100">Leo Wallet · Aleo Testnet：</span>
          {errorMessage}
        </p>
      ) : (
        <p className="text-[11px] leading-4 text-slate-500">
          Leo Wallet · <span className="text-emerald-200/80">Verified</span> · Aleo Testnet
          （testnetbeta）
          <span className="hidden sm:inline"> · Mobile Wallet 未验证</span>
        </p>
      )}
      <p className="max-w-96 truncate text-[10px] leading-4 text-slate-600" title={diagnosticText}>
        {diagnosticText}
      </p>
    </div>
  );
}
