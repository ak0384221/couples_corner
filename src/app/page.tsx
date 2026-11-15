import Link from "next/link";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Could not load your profile: ${profileError.message}`);
  if (!profile) redirect("/profile/setup");

  const { data: membership, error: membershipError } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) throw new Error(`Could not load your pairing: ${membershipError.message}`);

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
  const places = new Map((placesResult.data ?? []).map((place) => [place.id, place]));
  const upcoming = (dates ?? []).filter((date) => date.status !== "cancelled");

  return (
    <AppFrame title={`Hi, ${profile.name}`}>
      <div className="space-y-4">
        {!membership ? (
          <Card className="border-primary/40 bg-blush">
            <p className="text-sm font-bold text-primary">Your profile is ready</p>
            <h2 className="mt-1 text-xl font-bold">Want to invite your partner?</h2>
            <p className="mt-2 text-sm text-ink-soft">Pairing is optional for now. You can do it whenever they have made their profile.</p>
            <Link className="primary-button mt-4 inline-flex" href="/pair">Find and add partner</Link>
          </Card>
        ) : null}
        <Card className="bg-blush">
          <p className="text-sm font-semibold text-ink-soft">Make a little plan together</p>
          <h2 className="mt-1 text-2xl font-bold">A date is just a few taps away.</h2>
          {membership ? (
            <Link className="primary-button mt-4 inline-flex" href="/dates/new">Plan a date <span aria-hidden="true">♡</span></Link>
          ) : (
            <Link className="secondary-button mt-4 inline-flex" href="/pair">Pair to start planning <span aria-hidden="true">♡</span></Link>
          )}
        </Card>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Our dates</h2>
          <Link className="text-sm font-bold text-primary" href="/notifications">Notifications →</Link>
        </div>
        {upcoming.length ? upcoming.map((date) => {
          const place = places.get(date.place_id);
          return (
            <Link href={`/dates/${date.id}`} key={date.id} className="block">
              <Card className="transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{date.name || `${date.mood ?? "Our"} ${date.activity ?? "date"}`}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {new Date(`${date.day}T12:00:00`).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}
                      {" · "}{date.time_label || date.start_time.slice(0, 5)}
                    </p>
                    <p className="mt-2 text-sm">{place?.name ?? "Place"}{place?.address ? ` · ${place.address}` : ""}</p>
                  </div>
                  <span className={`status-pill status-${date.status}`}>{date.status}</span>
                </div>
              </Card>
            </Link>
          );
        }) : (
          <Card className="text-center">
            <p className="text-3xl" aria-hidden="true">✦</p>
            <p className="mt-2 font-bold">Your story starts with a plan.</p>
            <p className="mt-1 text-sm text-ink-soft">Plan your first date together.</p>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/closet"><Card className="h-full"><p className="text-2xl">♧</p><p className="mt-2 font-bold">Our closet</p></Card></Link>
          <Link href="/memories"><Card className="h-full"><p className="text-2xl">▧</p><p className="mt-2 font-bold">Memories</p></Card></Link>
          <Link href="/settings"><Card className="h-full"><p className="text-2xl">⚙</p><p className="mt-2 font-bold">Settings</p></Card></Link>
          <Link href="/profile"><Card className="h-full"><p className="text-2xl">♡</p><p className="mt-2 font-bold">Profile</p></Card></Link>
        </div>
      </div>
    </AppFrame>
  );
}
