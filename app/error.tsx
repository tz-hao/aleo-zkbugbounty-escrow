"use client";

import { RefreshCw, ShieldAlert } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { text } = useLocale();
  return <section className="surface-card-strong rounded-lg p-6 sm:p-8" role="alert"><div className="flex items-start gap-3"><ShieldAlert className="mt-1 shrink-0 text-red-200" size={22} aria-hidden="true" /><div><p className="page-kicker text-red-200">{text("安全错误边界", "Secure Error Boundary")}</p><h1 className="mt-2 text-2xl font-semibold text-white">{text("页面暂时无法完成此操作", "This page cannot complete the action right now")}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{text("未展示内部异常、请求内容或钱包数据。请重试；若 Aleo 节点接口不可用，真实模式会保持未确认状态。", "Internal errors, request content, and Wallet data are not displayed. Retry the action; if the Aleo Endpoint is unavailable, Real Mode remains unconfirmed.")}</p><button className="focus-ring secondary-action mt-5" type="button" onClick={reset}><RefreshCw size={16} aria-hidden="true" />{text("重试当前页面", "Retry this page")}</button></div></div></section>;
}