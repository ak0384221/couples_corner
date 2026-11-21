import type { Metadata, Viewport } from "next";
import { Inter, Quicksand } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { t } from "@/lib/text";

const quicksand = Quicksand({
  subsets: ["latin"],
  variable: "--font-quicksand",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-celebration-quote",
  display: "swap",
});

export const metadata: Metadata = {
  title: t.app.name,
  description: t.app.tagline,
  applicationName: t.app.name,
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: t.app.name,
    description: t.app.tagline,
    siteName: t.app.name,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: t.app.name,
    description: t.app.tagline,
  },
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
      className={`${quicksand.variable} ${inter.variable}`}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
