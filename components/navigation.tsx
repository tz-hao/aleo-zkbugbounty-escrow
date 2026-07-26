"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bug,
  ClipboardCheck,
  FilePlus2,
  Menu,
  ShieldCheck,
  TerminalSquare,
  X,
} from "lucide-react";
import { useState } from "react";

import { zh } from "@/lib/i18n/zh";
import { WalletConnectionControl } from "./wallet-connection-control";

const links = [
  { href: "/", label: zh.navigation.home, icon: ShieldCheck },
  { href: "/create-bounty", label: zh.navigation.createBounty, icon: FilePlus2 },
  { href: "/submit-proof", label: zh.navigation.submitProof, icon: TerminalSquare },
  { href: "/triage", label: zh.navigation.triage, icon: ClipboardCheck },
  { href: "/public-claims", label: zh.navigation.publicClaims, icon: Bug },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05070b]/90 shadow-[0_12px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="group flex min-w-0 shrink-0 items-center gap-2.5" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-cyan-200 transition group-hover:border-emerald-300/35 group-hover:text-emerald-100">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold text-white">zkBugBounty</span>
            <span className="hidden text-xs text-cyan-100/60 xl:block">
              {zh.brand.chineseSubtitle}
            </span>
          </span>
        </Link>

        <nav aria-label="主导航" className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
          <div className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  className={`focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition ${
                    active
                      ? "bg-white/[0.08] text-cyan-100"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                  }`}
                  href={href}
                  key={href}
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto hidden shrink-0 lg:block">
          <WalletConnectionControl />
        </div>
        <button
          aria-controls="mobile-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "关闭导航菜单" : "打开导航菜单"}
          className="focus-ring ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen ? (
        <div
          className="border-t border-white/10 bg-[#070b12]/98 px-4 py-4 shadow-2xl lg:hidden"
          id="mobile-navigation"
        >
          <nav aria-label="移动端主导航" className="grid gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  className={`focus-ring inline-flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                    active
                      ? "bg-cyan-300/10 text-cyan-100"
                      : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                  href={href}
                  key={href}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 border-t border-white/10 pt-4">
            <WalletConnectionControl />
          </div>
        </div>
      ) : null}
    </header>
  );
}
