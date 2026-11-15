import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BottomNavigation } from "@/components/bottom-navigation";
import { Heart } from "@/components/heart";
import { createClient } from "@/lib/supabase/server";

async function NotificationLink() {
  await connection();
  const supabase = await createClient();
  const { count: unreadCount, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw new Error(`Could not load unread notification count: ${error.message}`);

  return (
    <Link
      className="icon-button notification-button"
      href="/notifications"
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Heart size={25} />
      {unreadCount ? <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
    </Link>
  );
}

export async function AppFrame({
  title,
  backHref,
  children,
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh px-5 pb-28 pt-7">
      <header className="mb-6 flex items-center gap-3">
        {backHref ? (
          <Link className="icon-button" href={backHref} aria-label="Go back">
            ←
          </Link>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Our little corner</p>
          <h1 className="truncate text-2xl font-bold">{title}</h1>
        </div>
        <Suspense fallback={<Link className="icon-button notification-button" href="/notifications" aria-label="Notifications"><Heart size={25} /></Link>}>
          <NotificationLink />
        </Suspense>
      </header>
      {children}
      <BottomNavigation />
    </div>
  );
}
