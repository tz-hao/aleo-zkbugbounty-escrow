"use client";

import { Languages } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { useLocale, type Locale } from "./locale-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, text } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function updateLocale(nextLocale: Locale) {
    const params = new URLSearchParams(window.location.search);
    setLocale(nextLocale);
    if (nextLocale === "en") params.set("lang", "en");
    else params.delete("lang");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return <div aria-label={text("界面语言", "Interface language")} className={`inline-flex items-center rounded-md border border-white/10 bg-black/20 p-1 ${compact ? "" : "gap-1"}`}><Languages className="ml-1 text-slate-500" size={14} aria-hidden="true" /><button aria-pressed={locale === "zh"} className={`focus-ring min-h-8 rounded px-2 text-xs font-semibold ${locale === "zh" ? "bg-white/[0.09] text-white" : "text-slate-500 hover:text-slate-200"}`} onClick={() => updateLocale("zh")} type="button">中文</button><button aria-pressed={locale === "en"} className={`focus-ring min-h-8 rounded px-2 text-xs font-semibold ${locale === "en" ? "bg-white/[0.09] text-white" : "text-slate-500 hover:text-slate-200"}`} onClick={() => updateLocale("en")} type="button">EN</button></div>;
}