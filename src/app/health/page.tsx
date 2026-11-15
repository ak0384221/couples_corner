// Development-only check that the app can reach Supabase. Prints yes/no only, never a key or URL.
import { notFound } from "next/navigation";
import { t } from "@/lib/text";

export const dynamic = "force-dynamic";

type Check = {
  configured: boolean;
  reachable: boolean;
  signupsDisabled: boolean | null;
  secretKeySet: boolean;
};

async function runCheck(): Promise<Check> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKeySet = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) {
    return { configured: false, reachable: false, signupsDisabled: null, secretKeySet };
  }
  try {
    // Public Auth settings endpoint: proves the URL and key work, and tells us
    // whether sign-ups are disabled.
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { configured: true, reachable: false, signupsDisabled: null, secretKeySet };
    }
    const body: unknown = await res.json();
    const flag =
      typeof body === "object" && body !== null && "disable_signup" in body
        ? (body as { disable_signup: unknown }).disable_signup
        : null;
    return {
      configured: true,
      reachable: true,
      signupsDisabled: typeof flag === "boolean" ? flag : null,
      secretKeySet,
    };
  } catch {
    return { configured: true, reachable: false, signupsDisabled: null, secretKeySet };
  }
}

function Row({ label, value }: { label: string; value: boolean | null }) {
  const text = value === null ? t.health.unknown : value ? t.health.yes : t.health.no;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-ink-soft">{label}</span>
      <span className="font-bold">{text}</span>
    </div>
  );
}

export default async function HealthPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const c = await runCheck();

  return (
    <main className="px-6 py-12">
      <h1 className="mb-6 text-3xl font-bold">{t.health.title}</h1>
      <div className="divide-y divide-line rounded-card border-2 border-line bg-card px-5">
        <Row label={t.health.configured} value={c.configured} />
        <Row label={t.health.reachable} value={c.reachable} />
        <Row label={t.health.signupsOff} value={c.signupsDisabled} />
        <Row label={t.health.secretKey} value={c.secretKeySet} />
      </div>
    </main>
  );
}
