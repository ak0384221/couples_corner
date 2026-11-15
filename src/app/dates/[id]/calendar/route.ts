import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function calendarDate(day: string, time: string, addMinutes = 0): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const hours = Number(time.slice(0, 2));
  const minutes = Number(time.slice(3, 5));
  const totalMinutes = hours * 60 + minutes + addMinutes;
  const nextDate = new Date(Date.UTC(year, month - 1, date, 0, totalMinutes));
  return [
    nextDate.getUTCFullYear().toString().padStart(4, "0"),
    (nextDate.getUTCMonth() + 1).toString().padStart(2, "0"),
    nextDate.getUTCDate().toString().padStart(2, "0"),
    "T",
    nextDate.getUTCHours().toString().padStart(2, "0"),
    nextDate.getUTCMinutes().toString().padStart(2, "0"),
    "00",
  ].join("");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();
  const { data: date, error } = await supabase
    .from("dates")
    .select("id, name, day, start_time, status, place_id, food")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load date for calendar export: ${error.message}`);
  if (!date) return new Response("Not found", { status: 404 });
  if (date.status !== "confirmed") return new Response("Only confirmed dates can be added to a calendar.", { status: 409 });

  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("name, address")
    .eq("id", date.place_id)
    .maybeSingle();
  if (placeError) throw new Error(`Could not load date place: ${placeError.message}`);
  if (!place) return new Response("Not found", { status: 404 });

  const summary = escapeCalendarText(date.name || "Our date");
  const location = escapeCalendarText([place.name, place.address].filter(Boolean).join(", "));
  const description = escapeCalendarText(date.food ? `Craving: ${date.food}` : "A little time together.");
  const uid = `${date.id}@our-little-corner`;
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Our Little Corner//Date Planner//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${calendarDate(date.day, date.start_time)}`,
    `DTEND:${calendarDate(date.day, date.start_time, 120)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="our-date-${date.id}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
