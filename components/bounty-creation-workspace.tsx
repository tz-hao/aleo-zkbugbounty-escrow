"use client";

import { Database, FlaskConical } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AleoCreateBountyForm } from "./aleo-create-bounty-form";
import { BountyForm } from "./bounty-form";

type CreationMode = "real" | "demo";

export function BountyCreationWorkspace() {
  const [mode, setMode] = useState<CreationMode>("real");

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-kicker">Execution Mode</p>
          <p className="mt-2 text-sm text-slate-400">真实链上交易与本地演示状态严格隔离。</p>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1" aria-label="Bounty 创建模式">
          <ModeButton active={mode === "real"} onClick={() => setMode("real")}>
            <Database size={15} aria-hidden="true" />
            Aleo Testnet
          </ModeButton>
          <ModeButton active={mode === "demo"} onClick={() => setMode("demo")}>
            <FlaskConical size={15} aria-hidden="true" />
            Demo Local
          </ModeButton>
        </div>
      </div>
      {mode === "real" ? <AleoCreateBountyForm /> : <BountyForm />}
    </div>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
        active ? "bg-cyan-300/14 text-cyan-100" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
      }`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
