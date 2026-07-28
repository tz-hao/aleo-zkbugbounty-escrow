import type { Metadata } from "next";
import "./globals.css";
import { AppStateProvider } from "@/components/app-state-provider";
import { AleoWalletProvider } from "@/components/aleo-wallet-provider";
import { Navigation } from "@/components/navigation";
import { zh } from "@/lib/i18n/zh";

export const metadata: Metadata = {
  title: "zkBugBounty｜隐私漏洞证明协议",
  description: "证明漏洞存在，而不泄露 Exploit 细节。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppStateProvider>
          <AleoWalletProvider>
            <a className="skip-link" href="#main-content">{zh.common.skipToContent}</a>
            <Navigation />
            <main id="main-content" className="main-shell mx-auto flex w-full max-w-7xl flex-col gap-7 px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:px-8">
              {children}
            </main>
          </AleoWalletProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
