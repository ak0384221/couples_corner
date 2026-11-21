import { cacheLife } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getDatesHomeData() {
  "use cache: private";
  cacheLife({ stale: 30 });

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(`Could not verify your session: ${authError.message}`);
  if (!authData.user) return null;

  const userId = authData.user.id;
  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("profiles").select("id, name, birth_day, birth_month, birth_year").eq("id", userId).maybeSingle(),
    supabase.from("couple_members").select("couple_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (profileResult.error) throw new Error(`Could not load your profile: ${profileResult.error.message}`);
  if (membershipResult.error) throw new Error(`Could not load your pairing: ${membershipResult.error.message}`);

  let partner: { id: string; name: string; birth_day: number | null; birth_month: number | null; birth_year: number | null } | null = null;
  let togetherSince: string | null = null;
  if (membershipResult.data) {
    const [coupleResult, membersResult] = await Promise.all([
      supabase.from("couples").select("together_since").eq("id", membershipResult.data.couple_id).maybeSingle(),
      supabase.from("couple_members").select("user_id").eq("couple_id", membershipResult.data.couple_id),
    ]);
    if (coupleResult.error) throw new Error(`Could not load anniversary date: ${coupleResult.error.message}`);
    if (membersResult.error) throw new Error(`Could not load couple members: ${membersResult.error.message}`);
    togetherSince = coupleResult.data?.together_since ?? null;
    const partnerId = membersResult.data?.find((member) => member.user_id !== userId)?.user_id;
    if (partnerId) {
      const partnerResult = await supabase
        .from("profiles")
        .select("id, name, birth_day, birth_month, birth_year")
        .eq("id", partnerId)
        .maybeSingle();
      if (partnerResult.error) throw new Error(`Could not load your partner's birthday: ${partnerResult.error.message}`);
      partner = partnerResult.data;
    }
  }

  const { data: dates, error: datesError } = await supabase
    .from("dates")
    .select("id, name, day, start_time, time_label, status, place_id, food, mood, activity")
    .order("day", { ascending: true })
    .limit(30);
  if (datesError) throw new Error(`Could not load your dates: ${datesError.message}`);

  const placeIds = [...new Set((dates ?? []).map((date) => date.place_id))];
  const placesResult = placeIds.length
    ? await supabase.from("places").select("id, name, address").in("id", placeIds)
    : { data: [], error: null };
  if (placesResult.error) throw new Error(`Could not load date places: ${placesResult.error.message}`);

  return {
    profile: profileResult.data,
    membership: membershipResult.data,
    partner,
    togetherSince,
    dates: dates ?? [],
    places: placesResult.data ?? [],
  };
}

export async function getProfilePageData(userId: string) {
  "use cache: private";
  cacheLife({ stale: 30 });

  const supabase = await createClient();
  const [membershipResult, profileResult] = await Promise.all([
    supabase.from("couple_members").select("couple_id").eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("id, name, username, bio, photo_path").eq("id", userId).maybeSingle(),
  ]);
  if (membershipResult.error) throw new Error(`Could not load your pairing: ${membershipResult.error.message}`);
  if (profileResult.error) throw new Error(`Could not load your profile: ${profileResult.error.message}`);

  const membership = membershipResult.data;
  const myProfile = profileResult.data;
  if (!membership) {
    let avatarUrl: string | null = null;
    if (myProfile?.photo_path) {
      const { data, error } = await supabase.storage
        .from("photos")
        .createSignedUrl(myProfile.photo_path, 3600);
      if (error) throw new Error(`Could not create your private profile photo link: ${error.message}`);
      avatarUrl = data.signedUrl;
    }
    return { membership, myProfile, avatarUrl };
  }

  const [
    coupleResult,
    membersResult,
    dateCountResult,
    memoriesCountResult,
  ] = await Promise.all([
    supabase.from("couples").select("together_since").eq("id", membership.couple_id).maybeSingle(),
    supabase.from("couple_members").select("user_id").eq("couple_id", membership.couple_id),
    supabase.from("dates").select("id", { count: "exact", head: true }),
    supabase.from("albums").select("id", { count: "exact", head: true }),
  ]);
  if (coupleResult.error) throw new Error(`Could not load couple details: ${coupleResult.error.message}`);
  if (membersResult.error) throw new Error(`Could not load couple members: ${membersResult.error.message}`);
  if (dateCountResult.error) throw new Error(`Could not count dates: ${dateCountResult.error.message}`);
  if (memoriesCountResult.error) throw new Error(`Could not count memories: ${memoriesCountResult.error.message}`);

  const partnerId = membersResult.data?.find((member) => member.user_id !== userId)?.user_id;
  const partnerResult = partnerId
    ? await supabase.from("profiles").select("id, name, username, bio, photo_path").eq("id", partnerId).maybeSingle()
    : { data: null, error: null };
  if (partnerResult.error) throw new Error(`Could not load your partner's profile: ${partnerResult.error.message}`);

  const people = [myProfile, partnerResult.data].filter((person) => person !== null);
  const avatarPeople = people.filter((person) => person.photo_path);
  const avatarResult = avatarPeople.length
    ? await supabase.storage.from("photos").createSignedUrls(avatarPeople.map((person) => person.photo_path!), 3600)
    : { data: [], error: null };
  if (avatarResult.error) throw new Error(`Could not create avatar links: ${avatarResult.error.message}`);
  const avatarUrls = avatarPeople.map((person, index) => {
    const signed = avatarResult.data?.[index];
    if (signed?.error || !signed?.signedUrl) {
      throw new Error(`Could not create an avatar link: ${signed?.error ?? "No link returned."}`);
    }
    return [person.id, signed.signedUrl] as const;
  });

  return {
    membership,
    myProfile,
    couple: coupleResult.data,
    dateCount: dateCountResult.count ?? 0,
    memoriesCount: memoriesCountResult.count ?? 0,
    partner: partnerResult.data,
    avatarUrls,
  };
}
