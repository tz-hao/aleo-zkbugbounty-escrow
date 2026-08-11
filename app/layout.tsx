import type { Metadata } from "next";
import "./globals.css";
import { AppStateProvider } from "@/components/app-state-provider";
import { AleoWalletProvider } from "@/components/aleo-wallet-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { LocalizedSkipLink } from "@/components/localized-skip-link";
import { Navigation } from "@/components/navigation";

export const metadata: Metadata = {
  title: "zkBugBounty｜隐私漏洞证明协议",
  description: "证明漏洞存在，而不泄露利用细节。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppStateProvider>
          <LocaleProvider>
            <AleoWalletProvider>
              <LocalizedSkipLink />
              <Navigation />
              <main id="main-content" className="main-shell mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8">
                {children}
              </main>
            </AleoWalletProvider>
          </LocaleProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}