"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/text";

const items = [
  { href: "/explore", label: t.nav.explore, icon: "explore" },
  { href: "/memories", label: t.nav.memories, icon: "memories" },
  { href: "/", label: t.nav.dates, icon: "dates" },
  { href: "/profile", label: t.nav.profile, icon: "profile" },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <div className="bottom-nav-pill">
        {items.map(({ href, label, icon }) => {
          const active = href === "/"
            ? pathname === "/" || pathname.startsWith("/important-dates")
            : pathname === href || pathname.startsWith(`${href}/`);
          return <NavigationItem key={href} {...{ href, label, icon, active }} />;
        })}
      </div>
    </nav>
  );
}

export function BottomNavigationFallback() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <div className="bottom-nav-pill">
        {items.map(({ label, icon }) => (
          <span className="bottom-nav-item" key={label} aria-hidden="true">
            <NavigationIcon name={icon} />
          </span>
        ))}
      </div>
    </nav>
  );
}

function NavigationItem({
  href,
  label,
  icon,
  active,
}: (typeof items)[number] & { active: boolean }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={active ? "active" : undefined}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
    >
      <NavigationPending label={label} />
      <NavigationIcon name={icon} />
    </Link>
  );
}

function NavigationIcon({ name }: { name: string }) {
  const common = {
    "aria-hidden": true as const,
    className: "bottom-nav-icon",
    viewBox: "0 0 24 24",
  };

  if (name === "dates") {
    return (
      <svg {...common}>
        <path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" fill="currentColor" />
      </svg>
    );
  }

  if (name === "memories") {
    return (
      <svg {...common}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="currentColor" />
        <circle cx="9" cy="9.5" r="1.5" fill="white" />
        <path d="m5.5 17 4-3.5 2.7 2.2 2.4-2 3.9 3.3" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
      </svg>
    );
  }

  if (name === "profile") {
    return (
      <svg {...common}>
        <circle cx="12" cy="7.5" r="3.6" fill="currentColor" />
        <path d="M4 20a8 8 0 0 1 16 0c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m12 2.8 1.9 6.1 6.1 1.9-6.1 1.9-1.9 6.1-1.9-6.1L4 10.8l6.1-1.9L12 2.8Z" fill="currentColor" />
      <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" fill="currentColor" />
    </svg>
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
