import { notFound } from "next/navigation";
import { AppearanceForm } from "@/components/appearance-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppearancePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("theme_mode, theme_font, theme_accent, theme_font_color").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`Could not load appearance preferences: ${error.message}`);
  if (!profile) notFound();
  return (
    <AppFrame title="Appearance" backHref="/settings">
      <Card><p className="mb-4 text-sm text-ink-soft">Make our corner feel like yours. Dark mode keeps text readable.</p><AppearanceForm theme={profile} /></Card>
    </AppFrame>
  );
}
