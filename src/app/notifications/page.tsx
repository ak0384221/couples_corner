import { Suspense } from "react";
import Link from "next/link";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const descriptions: Record<string, string> = {
  pair_request_received: "wants to pair with you",
  paired: "You are paired. Your little corner is ready.",
  date_requested: "planned a date for you",
  date_confirmed: "confirmed your date",
  date_changed: "updated or suggested a change to your date",
  date_cancelled: "cancelled a date request",
  photos_added: "added new memories",
};

function notificationHref(type: string, id: string | null): string {
  if (!id) return "/";
  if (type === "date_requested" || type === "date_confirmed" || type === "date_changed" || type === "date_cancelled") return `/dates/${id}`;
  if (type === "photos_added") return `/memories/${id}`;
  if (type.startsWith("pair") || type === "paired") return "/pair";
  return "/";
}

function NotificationsLoading() {
  return (
    <AppFrame title="Notifications" backHref="/">
      <div className="space-y-3" aria-label="Loading notifications">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="h-24 animate-pulse rounded-card border border-line bg-card" key={index} />
        ))}
      </div>
    </AppFrame>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsLoading />}>
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: notifications, error } = await supabase.from("notifications").select("id, actor_id, event_type, ref_id, is_read, created_at").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`Could not load notifications: ${error.message}`);
  const actorIds = [...new Set((notifications ?? []).map((item) => item.actor_id).filter((id): id is string => Boolean(id) && id !== user.id))];
  const { data: actors, error: actorsError } = actorIds.length
    ? await supabase.from("profiles").select("id, name").in("id", actorIds)
    : { data: [], error: null };
  if (actorsError) throw new Error(`Could not load notification names: ${actorsError.message}`);
  const names = new Map((actors ?? []).map((actor) => [actor.id, actor.name]));
  const unread = (notifications ?? []).filter((item) => !item.is_read).length;
  return (
    <AppFrame title="Notifications" backHref="/">
      {unread ? <form action={markAllNotificationsRead} className="mb-4"><button className="secondary-button w-full">Mark all as read</button></form> : null}
      <div className="space-y-3">
        {(notifications ?? []).map((item) => (
          <Card className={!item.is_read ? "border-primary/50" : ""} key={item.id}>
            <div className="flex gap-3">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.is_read ? "bg-line" : "bg-primary"}`} aria-label={item.is_read ? "Read" : "Unread"} />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{names.get(item.actor_id ?? "") ?? "Your partner"} {descriptions[item.event_type] ?? "sent you an update"}</p>
                <p className="mt-1 text-xs text-ink-soft">{new Date(item.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link className="text-sm font-bold text-primary" href={notificationHref(item.event_type, item.ref_id)}>Open →</Link>
                  {!item.is_read ? <form action={markNotificationRead}><input type="hidden" name="notification_id" value={item.id} /><button className="text-xs font-bold text-ink-soft">Mark read</button></form> : null}
                </div>
              </div>
            </div>
          </Card>
        ))}
        {!notifications?.length ? <Card className="text-center text-sm text-ink-soft">Nothing new right now. Just the two of you, taking your time.</Card> : null}
      </div>
    </AppFrame>
  );
}
