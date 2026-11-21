import Image from "next/image";
import Link from "next/link";
import { AppFrame } from "@/components/app-frame";
import { Heart } from "@/components/heart";
import { Card } from "@/components/ui";
import { DHAKA_TIME_ZONE } from "@/lib/dhaka-time";
import { getProfilePageData } from "@/lib/navigation-data";
import { requireUser } from "@/lib/supabase/auth";

function dateInDhaka(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addCalendarMonths(date: Date, months: number): Date {
  const monthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day));
}

function calendarDaysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export default async function UsPage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const params = await searchParams;
  const profileUpdated = params.updated === "1";
  const user = await requireUser();
  const data = await getProfilePageData(user.id);
  const { membership, myProfile } = data;
  if (!membership) {
    return (
      <AppFrame title="Profile" className="profile-page-frame">
        <div className="space-y-4">
          {profileUpdated ? <Card className="border-primary/40 bg-blush text-center font-bold text-primary"><p role="status">Your profile was updated successfully.</p></Card> : null}
          <Card className="love-profile-card text-center">
            <div className="profile-avatar-orbit profile-avatar-orbit-single">
              {data.avatarUrl ? (
                <Image
                  src={data.avatarUrl}
                  alt={`${myProfile?.name ?? "Your"} profile photo`}
                  width={96}
                  height={96}
                  unoptimized
                  className="profile-avatar profile-avatar-single object-cover"
                />
              ) : (
                <div className="profile-avatar profile-avatar-single profile-avatar-initial">
                  {myProfile?.name.charAt(0).toUpperCase() ?? "♡"}
                </div>
              )}
            </div>
            <h2 className="mt-4 text-2xl font-bold">{myProfile?.name ?? "Your profile"}</h2>
            {myProfile ? <p className="mt-1 text-sm text-ink-soft">@{myProfile.username} · {myProfile.bio || "A little corner is waiting."}</p> : null}
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
  const { couple, dateCount, memoriesCount, partner, avatarUrls: avatarEntries } = data;
  const me = myProfile;
  const dhakaToday = dateInDhaka(new Date());
  const sinceDate = couple?.together_since ?? dhakaToday;
  const since = new Date(`${sinceDate}T00:00:00Z`);
  const today = new Date(`${dhakaToday}T00:00:00Z`);
  const daysTogether = Math.max(0, calendarDaysBetween(since, today));
  let yearsTogether = since > today ? 0 : today.getUTCFullYear() - since.getUTCFullYear();
  let anniversary = addCalendarMonths(since, yearsTogether * 12);
  if (since <= today && anniversary > today) {
    yearsTogether -= 1;
    anniversary = addCalendarMonths(since, yearsTogether * 12);
  }
  let monthsTogether = since > today ? 0 : (today.getUTCFullYear() - anniversary.getUTCFullYear()) * 12 + today.getUTCMonth() - anniversary.getUTCMonth();
  let monthiversary = addCalendarMonths(anniversary, monthsTogether);
  if (since <= today && monthiversary > today) {
    monthsTogether -= 1;
    monthiversary = addCalendarMonths(anniversary, monthsTogether);
  }
  const remainingDaysTogether = since > today ? 0 : calendarDaysBetween(monthiversary, today);
  const durationLabel = [
    `${yearsTogether} ${yearsTogether === 1 ? "year" : "years"}`,
    `${monthsTogether} ${monthsTogether === 1 ? "month" : "months"}`,
    `${remainingDaysTogether} ${remainingDaysTogether === 1 ? "day" : "days"}`,
  ].join(", ");
  const avatarUrls = new Map<string, string>(avatarEntries);
  return (
    <AppFrame title="Profile">
      <div className="space-y-4">
        {profileUpdated ? <Card className="border-primary/40 bg-blush text-center font-bold text-primary"><p role="status">Your profile was updated successfully.</p></Card> : null}
        <Card className="love-profile-card text-center">
          <div className="profile-avatar-orbit profile-avatar-orbit-paired">
            {[me, partner].filter((person) => person !== null).map((person) => (
              person ? avatarUrls.get(person.id)
                ? <Image key={person.id} src={avatarUrls.get(person.id)!} alt="" width={84} height={84} unoptimized className="profile-avatar profile-avatar-photo object-cover" />
                : <div key={person.id} className="profile-avatar profile-avatar-initial">{person.name.charAt(0).toUpperCase()}</div>
                : null
            ))}
            <Heart size={32} />
          </div>
          <h2 className="mt-4 text-2xl font-bold">{me?.name} &amp; {partner?.name ?? "your person"}</h2>
          {partner ? <p className="mt-1 text-sm text-ink-soft">@{partner.username} · {partner.bio ?? "Your favorite person."}</p> : null}
          <p className="mt-4 text-sm text-ink-soft">Together since {since.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</p>
        </Card>
        <div className="profile-stats grid grid-cols-3 gap-2 text-center">
          <Stat value={daysTogether.toLocaleString()} label="days together" detail={durationLabel} />
          <Stat value={String(dateCount ?? 0)} label="dates planned" />
          <Stat value={String(memoriesCount ?? 0)} label="memories saved" />
        </div>
        <Link href="/profile/edit" className="secondary-button w-full">Edit my profile</Link>
        <Link href="/settings" className="block text-center text-sm font-bold text-primary">Settings →</Link>
      </div>
    </AppFrame>
  );
}

function Stat({ value, label, detail }: { value: string; label: string; detail?: string }) {
  return <Card className="px-2 py-4"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-xs text-ink-soft">{label}</p>{detail ? <p className="mt-1 text-[10px] leading-tight text-ink-soft">{detail}</p> : null}</Card>;
}
