"use client";

import { Eye, SlidersHorizontal } from "lucide-react";

import { useAppState } from "./app-state-provider";
import { roleDisplayLabels } from "@/lib/i18n/glossary";
import type { Role } from "@/lib/models";

const roles: Role[] = ["ProjectOwner", "Whitehat", "TriageArbiter", "PublicUser"];

export function DemoRolePreview({ className = "" }: { className?: string }) {
  const { state, dispatch } = useAppState();

  return (
    <details
      className={`group rounded-lg border border-violet-300/20 bg-violet-300/[0.05] ${className}`}
    >
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-violet-100 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Demo Preview · 仅本地界面
        </span>
        <span className="truncate text-xs text-violet-200/75">
          {roleDisplayLabels[state.currentActor.role]}
        </span>
      </summary>
      <div className="border-t border-violet-300/15 px-3 pb-3 pt-3">
        <label className="block text-xs font-semibold text-slate-300" htmlFor="demo-role-preview">
          本地演示视角
        </label>
        <select
          className="focus-ring input-surface mt-2 h-11 w-full rounded-lg px-3 text-sm"
          id="demo-role-preview"
          onChange={(event) =>
            dispatch({ type: "switchActor", role: event.target.value as Role })
          }
          value={state.currentActor.role}
        >
          {roles.map((role) => (
            <option className="bg-slate-950" key={role} value={role}>
              {roleDisplayLabels[role]}
            </option>
          ))}
        </select>
        <p className="mt-2 flex gap-2 text-xs leading-5 text-slate-400">
          <Eye className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
          Demo Preview Only：仅改变本地界面与流程，不代表钱包身份，也不会获得链上权限。
        </p>
      </div>
    </details>
  );
}
