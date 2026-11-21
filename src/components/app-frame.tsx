import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AppBackButton } from "@/components/app-back-button";
import { Heart } from "@/components/heart";
import { getCurrentUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

async function NotificationLink() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;

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
  className = "",
}: {
  title: string;
  backHref?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-h-dvh px-5 pb-28 pt-7 ${className}`}>
      <header className="love-header mb-6 flex items-start gap-3">
        {backHref ? (
          <AppBackButton fallback={backHref} />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate love-page-title text-3xl font-semibold">{title}</h1>
        </div>
        <Suspense fallback={null}>
          <NotificationLink />
        </Suspense>
      </header>
      {children}
    </div>
  );
}
