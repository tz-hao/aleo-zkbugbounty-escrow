"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { en, type UiCopy } from "@/lib/i18n/en";
import { zh } from "@/lib/i18n/zh";

export type Locale = "zh" | "en";

type LocaleContextValue = {
  locale: Locale;
  copy: UiCopy;
  text: (chinese: string, english: string) => string;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function getLocaleFromSearch() {
  if (typeof window === "undefined") return "zh" as const;
  return new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "zh";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setLocale(getLocaleFromSearch()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  useEffect(() => {
    const syncLocale = () => setLocale(getLocaleFromSearch());
    window.addEventListener("popstate", syncLocale);
    return () => window.removeEventListener("popstate", syncLocale);
  }, []);

  const text = useCallback((chinese: string, english: string) => (locale === "en" ? english : chinese), [locale]);
  const value = useMemo<LocaleContextValue>(() => ({ locale, copy: locale === "en" ? en : zh, text, setLocale }), [locale, text]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}