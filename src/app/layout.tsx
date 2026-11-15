import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { t } from "@/lib/text";
import { AppLoading } from "@/components/app-loading";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.tagline,
  robots: { index: false, follow: false }, // private site
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fff3f6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={quicksand.variable}
    >
      <body>
        <Suspense fallback={<AppLoading />}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
