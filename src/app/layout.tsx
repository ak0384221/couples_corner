import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { t } from "@/lib/text";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  let theme = {
    theme_mode: "pink",
    theme_accent: "rose",
    theme_font: "soft",
    theme_font_color: "cocoa",
  };
  if (user) {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("theme_mode, theme_accent, theme_font, theme_font_color")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new Error(`Could not load appearance preferences: ${error.message}`);
    if (profile) theme = profile;
  }
  return (
    <html
      lang="en"
      className={quicksand.variable}
      data-theme={theme.theme_mode}
      data-accent={theme.theme_accent}
      data-font={theme.theme_font}
      data-font-color={theme.theme_font_color}
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
