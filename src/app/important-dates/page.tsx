import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { ImportantDateForm } from "@/components/important-date-form";
import { connection } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DHAKA_TIME_ZONE } from "@/lib/dhaka-time";
import { t } from "@/lib/text";

function dhakaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function nextOccurrence(date: string, today: ReturnType<typeof dhakaDateParts>) {
  const [, month, day] = date.split("-").map(Number);
  const todayKey = `${today.month.toString().padStart(2, "0")}-${today.day.toString().padStart(2, "0")}`;
  const eventKey = `${month?.toString().padStart(2, "0")}-${day?.toString().padStart(2, "0")}`;
  const year = eventKey >= todayKey ? today.year : today.year + 1;
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

export default async function ImportantDatesPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: dates, error } = await supabase
    .from("important_dates")
    .select("id, event_name, event_date")
    .order("event_date", { ascending: true });

  if (error) throw new Error(`Could not load important dates: ${error.message}`);
  await connection();
  const today = dhakaDateParts(new Date());
  const upcoming = (dates ?? [])
    .map((item) => ({ ...item, nextDate: nextOccurrence(item.event_date, today) }))
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  return (
    <AppFrame title={t.importantDates.title} backHref="/">
      <main className="space-y-5">
        <p className="text-sm leading-relaxed text-ink-soft">{t.importantDates.intro}</p>
        <Card>
          <ImportantDateForm />
        </Card>
        <section className="space-y-3" aria-labelledby="important-date-list-title">
          <h2 className="text-xl font-bold" id="important-date-list-title">{t.importantDates.upcoming}</h2>
          {upcoming.length ? upcoming.map((item) => (
            <Card key={item.id}>
              <p className="font-bold">{item.event_name}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {item.nextDate.toLocaleDateString("en", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}
                {" · "}{t.importantDates.repeats}
              </p>
            </Card>
          )) : (
            <Card className="text-center">
              <p className="font-bold">{t.importantDates.emptyTitle}</p>
              <p className="mt-1 text-sm text-ink-soft">{t.importantDates.emptyBody}</p>
            </Card>
          )}
        </section>
      </main>
    </AppFrame>
  );
}
