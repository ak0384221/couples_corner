import { notFound } from "next/navigation";
import { cancelDate, confirmDate, suggestDateChange } from "@/app/actions";
import { DateEditForm } from "@/components/date-edit-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { EXTERNAL_LINK_PROPS, mapsOpenUrl } from "@/lib/validation/maps-url";

export default async function DateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: date, error } = await supabase.from("dates").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load this date: ${error.message}`);
  if (!date) notFound();
  const { data: place, error: placeError } = await supabase.from("places").select("id, name, address, maps_url").eq("id", date.place_id).maybeSingle();
  if (placeError) throw new Error(`Could not load date place: ${placeError.message}`);
  if (!place) notFound();
  const creator = date.created_by === user.id;
  const isPending = date.status === "pending";
  const dateLabel = new Date(`${date.day}T12:00:00`).toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" });

  return (
    <AppFrame title={date.name || "Our date"} backHref="/">
      <div className="space-y-4">
        {query.email === "not-sent" ? (
          <Card className="border-primary/50 text-sm">
            <p role="status">Your date request and in-app notification are saved. Email delivery is paused for now.</p>
          </Card>
        ) : null}
        <Card className="text-center">
          <p className="text-4xl">{date.status === "confirmed" ? "♡" : date.status === "cancelled" ? "—" : "✦"}</p>
          <p className="mt-2 text-xl font-bold">
            {date.status === "confirmed" ? "It is a date!" : date.status === "cancelled" ? "Date cancelled" : creator ? "Request sent!" : "Needs your answer"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{date.status === "confirmed" ? "Saved for both of you." : date.status === "changed" ? creator ? "Your partner suggested a change. Update the plan and send it back." : "You suggested a change. Waiting for your partner to update the plan." : creator ? "Waiting for your partner to confirm." : "Your partner planned a date. Confirm to lock it in."}</p>
          <span className={`status-pill status-${date.status} mt-4`}>{date.status}</span>
        </Card>
        <Card>
          <dl className="divide-y divide-line">
            <InfoRow title="When" value={dateLabel} />
            <InfoRow title="Time (Dhaka)" value={`${date.start_time.slice(0, 5)} · ${date.time_label ?? "Any time"}`} />
            <InfoRow title="Place" value={place.name} />
            {place.address ? <InfoRow title="Address" value={place.address} /> : null}
            <InfoRow title="Craving" value={date.food ?? "A surprise"} />
            <InfoRow title="Mood and activity" value={`${date.mood ?? ""} · ${date.activity ?? ""}`} />
            {date.creator_outfit_style ? <InfoRow title="Outfit idea" value={`${date.creator_outfit_style} in ${date.creator_outfit_color ?? "any color"} · ${date.partner_outfit_style ?? ""} in ${date.partner_outfit_color ?? ""}`} /> : null}
          </dl>
          <a className="secondary-button mt-4 w-full" href={mapsOpenUrl(place)} {...EXTERNAL_LINK_PROPS}>Open in Google Maps ↗</a>
          {date.status === "confirmed" ? (
            <a className="primary-button mt-3 w-full" href={`/dates/${date.id}/calendar`}>Add to calendar</a>
          ) : null}
        </Card>
        {isPending && !creator ? (
          <Card>
            <p className="mb-3 text-sm text-ink-soft">We will tell your partner right away.</p>
            <form action={confirmDate}>
              <input type="hidden" name="date_id" value={date.id} />
              <button className="primary-button w-full">Confirm date</button>
            </form>
            <form action={suggestDateChange} className="mt-3">
              <input type="hidden" name="date_id" value={date.id} />
              <button className="secondary-button w-full">Suggest a change</button>
            </form>
          </Card>
        ) : null}
        {isPending && creator ? (
          <>
            <Card>
              <h2 className="mb-3 text-lg font-bold">Edit pending request</h2>
              <DateEditForm date={{ id: date.id, name: date.name, day: date.day, start_time: date.start_time, time_label: date.time_label }} />
            </Card>
            <form action={cancelDate}>
              <input type="hidden" name="date_id" value={date.id} />
              <button className="secondary-button w-full">Cancel request</button>
            </form>
          </>
        ) : null}
        {date.status === "changed" && creator ? (
          <Card>
            <h2 className="mb-3 text-lg font-bold">Update the date request</h2>
            <DateEditForm revised date={{ id: date.id, name: date.name, day: date.day, start_time: date.start_time, time_label: date.time_label }} />
          </Card>
        ) : null}
      </div>
    </AppFrame>
  );
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-ink-soft">{title}</dt><dd className="text-right font-semibold">{value}</dd></div>;
}
