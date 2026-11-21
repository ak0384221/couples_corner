import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function EditProfilePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("name, username, bio, birth_day, birth_month, birth_year, photo_path")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  if (!profile) notFound();
  const { data: avatar, error: avatarError } = profile.photo_path
    ? await supabase.storage.from("photos").createSignedUrl(profile.photo_path, 3600)
    : { data: null, error: null };
  if (avatarError) throw new Error(`Could not create your private profile photo link: ${avatarError.message}`);
  return (
    <AppFrame title="Edit my profile" backHref="/profile">
      <Card>
        <ProfileForm profile={profile} avatarUrl={avatar?.signedUrl ?? null} editing />
      </Card>
    </AppFrame>
  );
}
