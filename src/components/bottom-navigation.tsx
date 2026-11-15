"use client";

import Link from "next/link";
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
        return (
          <Link
            key={href}
            href={href}
            className={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden="true">{active ? activeIcon : icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
