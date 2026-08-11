"use client";

import { Database, FlaskConical, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";

import { AleoCreateBountyForm } from "./aleo-create-bounty-form";
import { AleoCreateBountyV3Form } from "./aleo-create-bounty-v3-form";
import { BountyForm } from "./bounty-form";
import { DemoRolePreview } from "./demo-role-preview";
import { useLocale } from "./locale-provider";

type CreationMode = "real" | "v3" | "demo";

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
        <div className="grid grid-cols-3 rounded-lg border border-white/10 bg-black/20 p-1" aria-label={text("赏金创建模式", "Bounty creation mode")}>
          <ModeButton active={mode === "real"} onClick={() => setMode("real")}><Database size={15} aria-hidden="true" />{text("Aleo 测试网（当前协议）", "Aleo Testnet (current)")}</ModeButton>
          <ModeButton active={mode === "v3"} onClick={() => setMode("v3")}><ShieldCheck size={15} aria-hidden="true" />V3</ModeButton>
          <ModeButton active={mode === "demo"} onClick={() => setMode("demo")}><FlaskConical size={15} aria-hidden="true" />{text("本地演示", "Demo Local")}</ModeButton>
        </div>
      </div>
      {mode === "real" ? (
        <AleoCreateBountyForm />
      ) : mode === "v3" ? (
        <AleoCreateBountyV3Form />
      ) : (
        <><DemoRolePreview /><BountyForm /></>
      )}
    </div>
  );
}

function ModeButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${active ? "bg-cyan-300/14 text-cyan-100" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`} type="button" aria-pressed={active} onClick={onClick}>{children}</button>;
}