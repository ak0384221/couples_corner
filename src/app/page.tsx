import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { getDatesHomeData } from "@/lib/navigation-data";
import { DHAKA_TIME_ZONE } from "@/lib/dhaka-time";
import { t } from "@/lib/text";

function dhakaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function anniversaryOrdinal(years: number): string {
  const remainder = years % 100;
  const suffix = remainder >= 11 && remainder <= 13
    ? "th"
    : years % 10 === 1
      ? "st"
      : years % 10 === 2
        ? "nd"
        : years % 10 === 3
          ? "rd"
          : "th";
  return `${years}${suffix}`;
}

function HomeLoading() {
  return (
    <AppFrame title={t.app.name}>
      <div className="skeleton-fade space-y-4" aria-label="Loading dates">
        <div className="ui-skeleton h-36 rounded-card" />
        <div className="ui-skeleton h-24 rounded-card" />
        <div className="ui-skeleton h-24 rounded-card" />
      </div>
    </AppFrame>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const data = await getDatesHomeData();
  if (!data) redirect("/login");
  const { profile, membership, partner, togetherSince, dates, places: placeRows } = data;
  if (!profile) redirect("/profile/setup");
  const places = new Map(placeRows.map((place) => [place.id, place]));
  const upcoming = dates.filter((date) => date.status !== "cancelled");
  await connection();
  const today = dhakaDateParts(new Date());
  const isPartnerBirthday = Boolean(
    partner?.birth_day === today.day && partner.birth_month === today.month,
  );
  const anniversaryDate = togetherSince ? new Date(`${togetherSince}T00:00:00Z`) : null;
  const anniversaryYears = anniversaryDate ? today.year - anniversaryDate.getUTCFullYear() : 0;
  const daysTogether = anniversaryDate
    ? Math.floor((Date.UTC(today.year, today.month - 1, today.day) - anniversaryDate.getTime()) / 86_400_000)
    : 0;
  const isAnniversary = Boolean(
    anniversaryDate &&
    anniversaryYears > 0 &&
    anniversaryDate.getUTCMonth() + 1 === today.month &&
    anniversaryDate.getUTCDate() === today.day,
  );

  return (
    <AppFrame title={`Hi, ${profile.name}`}>
      <div className="space-y-4">
        {isPartnerBirthday && partner ? (
          <CelebrationCard
            kind="birthday"
            eyebrow="Birthday today"
            title={`It’s ${partner.name}’s birthday!`}
            message="Make the day a little sweeter."
            primaryLabel="See memories"
            secondaryLabel="Plan a surprise"
          />
        ) : null}
        {isAnniversary ? (
          <CelebrationCard
            kind="anniversary"
            eyebrow="Today is your anniversary"
            title={`Happy ${anniversaryOrdinal(anniversaryYears)} Anniversary`}
            message={`${profile.name} & ${partner?.name ?? "your person"} · ${daysTogether} days together`}
            primaryLabel="See memories"
            secondaryLabel="Plan a date"
          />
        ) : null}
        {!membership ? (
          <Card className="border-primary/40 bg-blush">
            <p className="text-sm font-bold text-primary">Your profile is ready</p>
            <h2 className="mt-1 text-xl font-bold">Want to invite your partner?</h2>
            <p className="mt-2 text-sm text-ink-soft">Pairing is optional for now. You can do it whenever they have made their profile.</p>
            <Link className="primary-button mt-4 inline-flex" href="/pair">Find and add partner</Link>
          </Card>
        ) : null}
        <Card className="love-hero bg-blush">
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
                      {" · "}{date.time_label || date.start_time.slice(0, 5)} · Dhaka time
                    </p>
                    <p className="mt-2 text-sm">{place?.name ?? "Place"}{place?.address ? ` · ${place.address}` : ""}</p>
                  </div>
                  <span className={`status-pill status-${date.status}`}>{date.status}</span>
                </div>
              </Card>
            </Link>
          );
        }) : (
          <Card className="love-empty text-center">
            <div className="love-ring-small" aria-hidden="true"><span>♥</span></div>
            <p className="mt-2 font-bold">Your story starts with a plan.</p>
            <p className="mt-1 text-sm text-ink-soft">Plan your first date together.</p>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/memories"><Card className="h-full"><p className="text-2xl">▧</p><p className="mt-2 font-bold">Memories</p></Card></Link>
          <Link href="/important-dates"><Card className="h-full"><p className="text-2xl">♡</p><p className="mt-2 font-bold">{t.importantDates.title}</p></Card></Link>
          <Link href="/settings"><Card className="h-full"><p className="text-2xl">⚙</p><p className="mt-2 font-bold">Settings</p></Card></Link>
          <Link href="/profile"><Card className="h-full"><p className="text-2xl">♡</p><p className="mt-2 font-bold">Profile</p></Card></Link>
        </div>
      </div>
    </AppFrame>
  );
}

function CelebrationCard({
  kind,
  eyebrow,
  title,
  message,
  primaryLabel,
  secondaryLabel,
}: {
  kind: "birthday" | "anniversary";
  eyebrow: string;
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  return (
    <Card className={`celebration-card celebration-${kind}`}>
      <span className="celebration-sparkles" aria-hidden="true">♥ · ✦ · ♥</span>
      <p className="celebration-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p className="celebration-message">{message}</p>
      <div className="celebration-actions">
        <Link href="/memories" className="celebration-action celebration-action-light">{primaryLabel}</Link>
        <Link href="/dates/new" className="celebration-action celebration-action-outline">{secondaryLabel}</Link>
      </div>
    </Card>
  );
}
