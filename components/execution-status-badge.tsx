"use client";

import { CircleAlert, CloudCog, ShieldCheck } from "lucide-react";

import { useLocale } from "./locale-provider";

type ExecutionStatusKind = "onchain" | "local" | "unavailable";

const statusStyles: Record<ExecutionStatusKind, string> = {
  onchain: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  local: "border-violet-300/25 bg-violet-300/10 text-violet-100",
  unavailable: "border-amber-300/25 bg-amber-300/10 text-amber-100",
};

const statusLabels: Record<ExecutionStatusKind, readonly [string, string]> = {
  onchain: ["链上已确认", "On-chain confirmed"],
  local: ["本地模拟", "Local simulation"],
  unavailable: ["等待程序升级", "Awaiting program upgrade"],
};

const statusIcons = {
  onchain: ShieldCheck,
  local: CloudCog,
  unavailable: CircleAlert,
};

export function ExecutionStatusBadge({
  kind,
  label,
}: {
  kind: ExecutionStatusKind;
  label?: string;
}) {
  const { text } = useLocale();
  const Icon = statusIcons[kind];
  const [chineseLabel, englishLabel] = statusLabels[kind];

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold ${statusStyles[kind]}`}
    >
      <Icon size={13} aria-hidden="true" />
      {label ?? text(chineseLabel, englishLabel)}
    </span>
  );
}