import Link from "next/link";
import { setEmailAlerts, signOut, signOutEverywhere } from "@/app/actions";
import { PasswordForm } from "@/components/password-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_DELIVERY_PAUSED } from "@/lib/notifications/email";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile, error } = await supabase.from("profiles").select("name, username, email_alerts, theme_mode, theme_font").eq("id", user.id).maybeSingle();
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  const { data: members, error: membersError } = await supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle();
  if (membersError) throw new Error(`Could not load pairing: ${membersError.message}`);
  const emailConfigured = !EMAIL_DELIVERY_PAUSED && Boolean(
    process.env.RESEND_API_KEY &&
    process.env.RESEND_FROM_EMAIL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return (
    <AppFrame title="Settings">
      <div className="space-y-4">
        {profile ? <Card className="flex items-center justify-between gap-3"><div><p className="font-bold">{profile.name}</p><p className="text-sm text-ink-soft">@{profile.username}</p></div><Link className="text-sm font-bold text-primary" href="/profile/edit">Edit</Link></Card> : null}
        <Link href="/settings/appearance" className="block"><Card><p className="font-bold">Appearance</p><p className="mt-1 text-sm text-ink-soft">{profile?.theme_mode ?? "Pink"} · {profile?.theme_font ?? "Soft"} ›</p></Card></Link>
        {profile ? (
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-bold">Email alerts</p><p className="mt-1 text-xs text-ink-soft">{EMAIL_DELIVERY_PAUSED ? "Email delivery is paused for now. In-app notifications are still active." : emailConfigured ? "Short updates only; no photos or private notes." : "Add a verified Resend sender to enable email delivery."}</p></div>
              <form action={setEmailAlerts}>
                <input type="hidden" name="enabled" value={profile.email_alerts ? "false" : "true"} />
                <button className="secondary-button" disabled={!profile.email_alerts && !emailConfigured}>{EMAIL_DELIVERY_PAUSED && profile.email_alerts ? "On · paused" : profile.email_alerts ? "On" : "Off"}</button>
              </form>
            </div>
          </Card>
        ) : null}
        <Card>
          <h2 className="mb-3 text-lg font-bold">Change password</h2>
          <PasswordForm />
        </Card>
        <Card>
          <p className="font-bold">Two-factor login</p>
          <p className="mt-1 text-sm text-ink-soft">Authenticator-app verification is supported at sign-in. Enroll a verified TOTP factor in Supabase Auth before requiring it for these accounts.</p>
        </Card>
        <Card>
          <p className="font-bold">Your little corner</p>
          <p className="mt-1 text-sm text-ink-soft">{members ? "You are paired with your person." : "You can use your profile now and add your partner later."}</p>
          {!members ? <Link className="primary-button mt-4 w-full" href="/pair">Find and add partner</Link> : null}
        </Card>
        <form action={signOutEverywhere}><button className="secondary-button w-full">Sign out of all devices</button></form>
        <form action={signOut}><button className="primary-button w-full">Sign out</button></form>
        <Link href="/" className="block text-center text-sm font-bold text-primary">Back to our dates</Link>
      </div>
    </AppFrame>
  );
}
