import Image from "next/image";
import Link from "next/link";
import { AppFrame } from "@/components/app-frame";
import { Heart } from "@/components/heart";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function UsPage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const params = await searchParams;
  const profileUpdated = params.updated === "1";
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error(`Could not load your pairing: ${membershipError.message}`);
  if (!membership) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("name, username, bio, photo_path")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw new Error(`Could not load your profile: ${error.message}`);
    let avatarUrl: string | null = null;
    if (profile?.photo_path) {
      const { data, error: avatarError } = await supabase.storage
        .from("photos")
        .createSignedUrl(profile.photo_path, 3600);
      if (avatarError) throw new Error(`Could not create your private profile photo link: ${avatarError.message}`);
      avatarUrl = data.signedUrl;
    }
    return (
      <AppFrame title="Profile">
        <div className="space-y-4">
          {profileUpdated ? <Card className="border-primary/40 bg-blush text-center font-bold text-primary"><p role="status">Your profile was updated successfully.</p></Card> : null}
          <Card className="text-center">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={`${profile?.name ?? "Your"} profile photo`}
                width={96}
                height={96}
                unoptimized
                className="mx-auto h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blush text-3xl text-primary">
                {profile?.name.charAt(0).toUpperCase() ?? "♡"}
              </div>
            )}
            <h2 className="mt-4 text-2xl font-bold">{profile?.name ?? "Your profile"}</h2>
            {profile ? <p className="mt-1 text-sm text-ink-soft">@{profile.username} · {profile.bio || "A little corner is waiting."}</p> : null}
          </Card>
          <Card>
            <h2 className="font-bold">Your partner is not here yet</h2>
            <p className="mt-1 text-sm text-ink-soft">Pairing is optional. When your partner has made a profile, find them by their exact username.</p>
            <Link href="/pair" className="primary-button mt-4 w-full">Find and add partner</Link>
          </Card>
          <Link href="/profile/edit" className="secondary-button w-full">Edit my profile</Link>
          <Link href="/settings" className="block text-center text-sm font-bold text-primary">Settings →</Link>
        </div>
      </AppFrame>
    );
  }
  const [{ data: couple, error: coupleError }, { data: members, error: membersError }] = await Promise.all([
    supabase.from("couples").select("together_since").eq("id", membership.couple_id).maybeSingle(),
    supabase.from("couple_members").select("user_id").eq("couple_id", membership.couple_id),
  ]);
  if (coupleError) throw new Error(`Could not load couple details: ${coupleError.message}`);
  if (membersError) throw new Error(`Could not load couple members: ${membersError.message}`);
  const partnerId = members?.find((member) => member.user_id !== user.id)?.user_id;
  const memberIds = members?.map((member) => member.user_id) ?? [user.id];
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("id, name, username, bio, photo_path").in("id", memberIds);
  if (profileError) throw new Error(`Could not load couple profiles: ${profileError.message}`);
  const me = profiles?.find((profile) => profile.id === user.id);
  const partner = profiles?.find((profile) => profile.id === partnerId);
  const [{ count: dateCount, error: dateError }, { count: photoCount, error: photoError }] = await Promise.all([
    supabase.from("dates").select("id", { count: "exact", head: true }),
    supabase.from("photos").select("id", { count: "exact", head: true }),
  ]);
  if (dateError) throw new Error(`Could not count dates: ${dateError.message}`);
  if (photoError) throw new Error(`Could not count photos: ${photoError.message}`);
  const since = couple?.together_since ? new Date(`${couple.together_since}T00:00:00`) : new Date();
  const daysTogether = Math.max(0, Math.floor((new Date().getTime() - since.getTime()) / 86_400_000));
  const avatars = await Promise.all((profiles ?? []).map(async (profile) => {
    if (!profile.photo_path) return { id: profile.id, url: null };
    const { data, error } = await supabase.storage.from("photos").createSignedUrl(profile.photo_path, 3600);
    if (error) throw new Error(`Could not create an avatar link: ${error.message}`);
    return { id: profile.id, url: data.signedUrl };
  }));
  const avatarUrls = new Map(avatars.map((avatar) => [avatar.id, avatar.url]));
  return (
    <AppFrame title="Profile">
      <div className="space-y-4">
        {profileUpdated ? <Card className="border-primary/40 bg-blush text-center font-bold text-primary"><p role="status">Your profile was updated successfully.</p></Card> : null}
        <Card className="text-center">
          <div className="relative flex items-center justify-center -space-x-3">
            {[me, partner].filter(Boolean).map((person) => (
              person ? avatarUrls.get(person.id)
                ? <Image key={person.id} src={avatarUrls.get(person.id)!} alt="" width={84} height={84} unoptimized className="h-20 w-20 rounded-full border-4 border-card object-cover" />
                : <div key={person.id} className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-card bg-blush text-3xl">{person.name.charAt(0).toUpperCase()}</div>
                : null
            ))}
            <span className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card p-1">
              <Heart size={22} />
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold">{me?.name} &amp; {partner?.name ?? "your person"}</h2>
          {partner ? <p className="mt-1 text-sm text-ink-soft">@{partner.username} · {partner.bio ?? "Your favorite person."}</p> : null}
          <p className="mt-4 text-sm text-ink-soft">Together since {since.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</p>
        </Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={daysTogether.toLocaleString()} label="days together" />
          <Stat value={String(dateCount ?? 0)} label="dates planned" />
          <Stat value={String(photoCount ?? 0)} label="photos saved" />
        </div>
        <Link href="/profile/edit" className="secondary-button w-full">Edit my profile</Link>
        <Link href="/settings" className="block text-center text-sm font-bold text-primary">Settings →</Link>
      </div>
    </AppFrame>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <Card className="px-2 py-4"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-xs text-ink-soft">{label}</p></Card>;
}
