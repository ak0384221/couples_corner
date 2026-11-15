"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/text";

const items = [
  { href: "/memories", label: t.nav.memories, icon: "▧", activeIcon: "▦" },
  { href: "/", label: t.nav.dates, icon: "♡", activeIcon: "♥" },
  { href: "/profile", label: t.nav.profile, icon: "✦", activeIcon: "✦" },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.map(({ href, label, icon, activeIcon }) => {
        const active = href === "/"
          ? pathname === "/"
          : pathname === href || pathname.startsWith(`${href}/`);
        return <NavigationItem key={href} {...{ href, label, icon, activeIcon, active }} />;
      })}
    </nav>
  );
}

function NavigationItem({
  href,
  label,
  icon,
  activeIcon,
  active,
}: (typeof items)[number] & { active: boolean }) {
  return (
    <Link
      href={href}
      className={active ? "active" : undefined}
      aria-current={active ? "page" : undefined}
    >
      <NavigationPending label={label} />
      <span aria-hidden="true">{active ? activeIcon : icon}</span>
      {label}
    </Link>
  );
}

function NavigationPending({ label }: { label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span className="navigation-progress" data-pending={pending} aria-hidden="true" />
      <span className="sr-only" aria-live="polite">{pending ? `Loading ${label}` : ""}</span>
    </>
  );
}
