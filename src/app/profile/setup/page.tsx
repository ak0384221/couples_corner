import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileSetupPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`Could not check your profile: ${error.message}`);
  if (data) redirect("/");
  return (
    <AppFrame title="Make your profile">
      <Card>
        <p className="mb-5 text-sm text-ink-soft">This is how your partner sees you. Choose a username they can find.</p>
        <ProfileForm />
      </Card>
    </AppFrame>
  );
}
