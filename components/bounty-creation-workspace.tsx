"use client";

import { Database, FlaskConical, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AleoCreateBountyForm } from "./aleo-create-bounty-form";
import { AleoCreateBountyV3Form } from "./aleo-create-bounty-v3-form";
import { BountyForm } from "./bounty-form";
import { DemoRolePreview } from "./demo-role-preview";
import { useLocale } from "./locale-provider";

type CreationMode = "real" | "legacy" | "demo";

export function BountyCreationWorkspace() {
  const [mode, setMode] = useState<CreationMode>("real");
  const { text } = useLocale();

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-kicker">{text("执行环境", "Execution environment")}</p>
          <p className="mt-2 text-sm text-slate-400">{text("链上交易与本地模拟使用独立的数据和权限边界。", "On-chain transactions and local simulation use separate data and permission boundaries.")}</p>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-1" aria-label={text("赏金创建模式", "Bounty creation mode")}>
          <ModeButton active={mode === "real"} onClick={() => setMode("real")}><ShieldCheck size={15} aria-hidden="true" />{text("Aleo 测试网（V3 当前协议）", "Aleo Testnet (V3 current)")}</ModeButton>
          <ModeButton active={mode === "demo"} onClick={() => setMode("demo")}><FlaskConical size={15} aria-hidden="true" />{text("本地演示", "Demo Local")}</ModeButton>
        </div>
      </div>
      <details className="rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-4" open={mode === "legacy"}>
        <summary className="focus-ring cursor-pointer list-none text-sm font-semibold text-amber-100">
          <span className="inline-flex items-center gap-2"><Database size={15} aria-hidden="true" />{text("历史兼容：已有 V2 赏金", "Historical compatibility: existing V2 Bounties")}</span>
        </summary>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-xs leading-5 text-amber-100/75">
            {text("仅在继续处理已存在的 V2 链上数据时使用。新赏金必须使用当前 V3 协议；这里不会创建新的 V2 流程。", "Use this only to continue existing V2 on-chain data. New Bounties must use the current V3 protocol; no new V2 flow should start here.")}
          </p>
          <button className="secondary-action border-amber-300/25 text-amber-100" type="button" aria-pressed={mode === "legacy"} onClick={() => setMode("legacy")}>
            {text("打开 V2 兼容", "Open V2 compatibility")}
          </button>
        </div>
      </details>
      {mode === "real" ? (
        <AleoCreateBountyV3Form />
      ) : mode === "legacy" ? (
        <AleoCreateBountyForm legacy />
      ) : (
        <><DemoRolePreview /><BountyForm /></>
      )}
    </div>
  );
}

function ModeButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${active ? "bg-cyan-300/14 text-cyan-100" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`} type="button" aria-pressed={active} onClick={onClick}>{children}</button>;
}
