import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { NavigationHistoryProvider } from "@/components/navigation-history";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

// Account preferences are request-time; only the surrounding shell is prerendered.
export async function AppShell({ children }: { children: React.ReactNode }) {
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
    <div
      className="app-column overflow-hidden bg-page"
      data-theme={theme.theme_mode}
      data-accent={theme.theme_accent}
      data-font={theme.theme_font}
      data-font-color={theme.theme_font_color}
    >
      <NavigationHistoryProvider>
        <Suspense fallback={<AppLoading />}>{children}</Suspense>
      </NavigationHistoryProvider>
    </div>
  );
}
