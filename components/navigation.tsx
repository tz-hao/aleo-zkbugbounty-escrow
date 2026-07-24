"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug, ClipboardCheck, FilePlus2, Radio, ShieldCheck, TerminalSquare } from "lucide-react";
import { useAppState } from "./app-state-provider";
import { roleDisplayLabels } from "@/lib/i18n/glossary";
import { zh } from "@/lib/i18n/zh";
import type { Role } from "@/lib/models";
import { WalletConnectionControl } from "./wallet-connection-control";

const links = [
  { href: "/", label: zh.navigation.home, icon: ShieldCheck },
  { href: "/create-bounty", label: zh.navigation.createBounty, icon: FilePlus2 },
  { href: "/submit-proof", label: zh.navigation.submitProof, icon: TerminalSquare },
  { href: "/triage", label: zh.navigation.triage, icon: ClipboardCheck },
  { href: "/public-claims", label: zh.navigation.publicClaims, icon: Bug },
];

const roles: Role[] = ["ProjectOwner", "Whitehat", "TriageArbiter", "PublicUser"];

export function Navigation() {
  const pathname = usePathname();
  const { state, dispatch } = useAppState();

  return (
    <header className="sticky top-0 z-20 overflow-x-clip border-b border-white/10 bg-[#05070b]/82 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link className="group flex min-w-0 items-center gap-3" href="/">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 transition group-hover:border-emerald-300/35 group-hover:text-emerald-100">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-wide text-white">
                zkBugBounty
                <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">
                  {zh.common.liveDemo}
                </span>
              </span>
              <span className="mt-0.5 hidden text-xs text-cyan-100/64 sm:block">
                {zh.brand.chineseSubtitle}
              </span>
            </span>
          </Link>
          <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center">
            <WalletConnectionControl />
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <Radio size={13} aria-hidden="true" />
              {zh.common.protocolConsole}
            </span>
            <span className="text-xs font-semibold tracking-normal text-slate-400">{zh.common.currentRole}</span>
            <select
              className="focus-ring input-surface h-10 w-full min-w-0 rounded-lg px-3 text-sm sm:w-auto"
              onChange={(event) => dispatch({ type: "switchActor", role: event.target.value as Role })}
              value={state.currentActor.role}
            >
              {roles.map((role) => (
                <option className="bg-slate-950" key={role} value={role}>
                  {roleDisplayLabels[role]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <nav aria-label="Primary navigation" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                className={`focus-ring inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-center text-xs transition last:col-span-2 sm:gap-2 sm:px-3 sm:text-sm sm:last:col-span-1 ${
                  active
                    ? "border-cyan-300/45 bg-cyan-300/14 text-cyan-100 shadow-[0_0_28px_rgba(48,213,255,0.09)]"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.07]"
                }`}
                href={href}
                key={href}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
