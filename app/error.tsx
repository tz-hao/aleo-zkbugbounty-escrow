"use client";

import { RefreshCw, ShieldAlert } from "lucide-react";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="surface-card-strong rounded-lg p-6 sm:p-8" role="alert">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 shrink-0 text-red-200" size={22} aria-hidden="true" />
        <div>
          <p className="page-kicker text-red-200">Secure Error Boundary</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">页面暂时无法完成此操作</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            未展示内部异常、请求内容或 Wallet 数据。请重试；若 Aleo Endpoint 不可用，Real Mode 会保持未确认状态。
          </p>
          <button className="focus-ring secondary-action mt-5" type="button" onClick={reset}>
            <RefreshCw size={16} aria-hidden="true" />
            重试当前页面
          </button>
        </div>
      </div>
    </section>
  );
}
