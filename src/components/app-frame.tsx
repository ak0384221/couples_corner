import Link from "next/link";
import { Heart } from "@/components/heart";
import { t } from "@/lib/text";
import { createClient } from "@/lib/supabase/server";

export async function AppFrame({
  title,
  backHref,
  children,
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { count: unreadCount, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw new Error(`Could not load unread notification count: ${error.message}`);

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
        <Link
          className="icon-button notification-button"
          href="/notifications"
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Heart size={25} />
          {unreadCount ? <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
        </Link>
      </header>
      {children}
      <nav className="bottom-nav" aria-label="Main navigation">
        <Link href="/memories"><span aria-hidden="true">▧</span>Memories</Link>
        <Link href="/"><span aria-hidden="true">♡</span>Dates</Link>
        <Link href="/profile"><span aria-hidden="true">✦</span>{t.nav.profile}</Link>
      </nav>
    </div>
  );
}
