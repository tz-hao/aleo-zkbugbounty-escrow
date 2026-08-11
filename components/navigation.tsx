"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug, ClipboardCheck, FilePlus2, Menu, Radio, ShieldCheck, TerminalSquare, X } from "lucide-react";
import { useState } from "react";

import { LanguageSwitcher } from "./language-switcher";
import { useLocale } from "./locale-provider";
import { WalletConnectionControl } from "./wallet-connection-control";

export function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { copy, text } = useLocale();
  const links = [
    { href: "/", label: copy.navigation.home, icon: ShieldCheck },
    { href: "/create-bounty", label: copy.navigation.createBounty, icon: FilePlus2 },
    { href: "/submit-proof", label: copy.navigation.submitProof, icon: TerminalSquare },
    { href: "/triage", label: copy.navigation.triage, icon: ClipboardCheck },
    { href: "/public-claims", label: copy.navigation.publicClaims, icon: Bug },
  ];

  if (pathname === "/") return null;

  return (
    <header className="site-navigation sticky top-0 z-40 px-3 pt-3">
      <div className="nav-glass mx-auto flex h-[3.75rem] max-w-7xl items-center gap-3 rounded-lg px-3 sm:px-4 lg:px-5">
        <Link className="group flex min-w-0 shrink-0 items-center gap-2.5" href="/">
          <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-lg transition group-hover:border-emerald-300/40">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white sm:text-base">zkBugBounty</span>
            <span className="hidden text-[0.68rem] text-slate-500 2xl:block">零知识负责任披露</span>
          </span>
        </Link>

        <span className="hidden items-center gap-2 rounded-md border border-emerald-300/15 bg-emerald-300/[0.055] px-2.5 py-1.5 text-[0.68rem] font-semibold text-emerald-100 xl:inline-flex">
          <span className="network-pulse" aria-hidden="true" />
          Aleo Testnet
        </span>

        <nav aria-label={text("主导航", "Primary navigation")} className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-0.5">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link className={`focus-ring relative inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition xl:text-sm ${active ? "bg-white/[0.055] text-white" : "text-slate-400 hover:bg-white/[0.035] hover:text-slate-100"}`} href={href} key={href}>
                  {label}
                  {active ? <span className="absolute inset-x-3 -bottom-[0.65rem] h-px bg-gradient-to-r from-transparent via-emerald-300 to-transparent" aria-hidden="true" /> : null}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-2 lg:flex">
          <LanguageSwitcher />
          <WalletConnectionControl />
        </div>
        <button aria-controls="mobile-navigation" aria-expanded={mobileOpen} aria-label={mobileOpen ? text("关闭导航菜单", "Close navigation menu") : text("打开导航菜单", "Open navigation menu")} className="focus-ring ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 lg:hidden" onClick={() => setMobileOpen((open) => !open)} type="button">
          {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="nav-glass mx-auto mt-2 max-w-7xl rounded-lg p-3 shadow-2xl lg:hidden" id="mobile-navigation">
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] px-2 pb-3">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-100"><span className="network-pulse" aria-hidden="true" />{text("Aleo 测试网", "Aleo Testnet")}</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.68rem] text-slate-500"><Radio size={12} aria-hidden="true" />testnetbeta</span>
          </div>
          <nav aria-label={text("移动端主导航", "Mobile navigation")} className="grid gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link className={`focus-ring inline-flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${active ? "bg-emerald-300/[0.08] text-emerald-100" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"}`} href={href} key={href} onClick={() => setMobileOpen(false)}>
                  <Icon size={17} aria-hidden="true" />{label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="mb-3"><LanguageSwitcher /></div>
            <WalletConnectionControl />
          </div>
        </div>
      ) : null}
    </header>
  );
}