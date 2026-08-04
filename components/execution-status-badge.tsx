import { CircleAlert, CloudCog, ShieldCheck } from "lucide-react";

type ExecutionStatusKind = "onchain" | "local" | "unavailable";

const statusStyles: Record<ExecutionStatusKind, string> = {
  onchain: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  local: "border-violet-300/25 bg-violet-300/10 text-violet-100",
  unavailable: "border-amber-300/25 bg-amber-300/10 text-amber-100",
};

const statusLabels: Record<ExecutionStatusKind, string> = {
  onchain: "On-chain confirmed",
  local: "Local simulation",
  unavailable: "Awaiting program upgrade",
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
  const Icon = statusIcons[kind];

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold ${statusStyles[kind]}`}
    >
      <Icon size={13} aria-hidden="true" />
      {label ?? statusLabels[kind]}
    </span>
  );
}
