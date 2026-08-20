import type { Metadata, Viewport } from "next";

import { WalletContextProvider } from "@/lib/wallet/context";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HerLedger",
    template: "%s | HerLedger",
  },
  description: "Build a verifiable financial history for your business on Stellar.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
