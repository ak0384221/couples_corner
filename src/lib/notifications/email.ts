import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const eventCopy = {
  pair_request_received: "Someone sent you a pair request.",
  paired: "Your little corner is ready.",
  date_requested: "A date request is waiting for you.",
  date_confirmed: "Your date was confirmed.",
  date_changed: "There is an update to your date plan.",
  date_cancelled: "A date request was cancelled.",
  closet_preference_sent: "Outfit ideas are waiting for you.",
  closet_preference_accepted: "Your outfit ideas were accepted.",
  closet_preference_changed: "There is an update to your outfit ideas.",
  photos_added: "A new memory was added.",
} as const;

export type AppEmailEvent = keyof typeof eventCopy;

export const EMAIL_DELIVERY_PAUSED = true;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function sendAppEmail(
  recipientId: string,
  event: AppEmailEvent,
  dateId?: string,
): Promise<boolean> {
  // Temporarily pause external email delivery while preserving in-app notifications.
  if (EMAIL_DELIVERY_PAUSED) {
    console.info(`Email notification skipped (${event}): delivery is temporarily paused.`);
    return false;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error(`Email notification skipped (${event}): Resend is not configured.`);
    return false;
  }

  try {
    const admin = createAdminClient();
    const [{ data: profile, error: profileError }, { data: authResult, error: authError }] = await Promise.all([
      admin.from("profiles").select("email_alerts").eq("id", recipientId).maybeSingle(),
      admin.auth.admin.getUserById(recipientId),
    ]);
    if (profileError || authError) {
      console.error(`Email notification could not load recipient (${event}).`);
      return false;
    }
    if (!profile?.email_alerts || !authResult.user?.email) return true;

    let dateSummary = "";
    if (dateId) {
      const { data: date, error: dateError } = await admin
        .from("dates")
        .select("day, start_time, time_label, place_id")
        .eq("id", dateId)
        .maybeSingle();
      if (dateError) {
        console.error(`Email notification could not load date details (${event}).`);
        return false;
      }
      if (date) {
        const { data: place, error: placeError } = await admin
          .from("places")
          .select("name")
          .eq("id", date.place_id)
          .maybeSingle();
        if (placeError) {
          console.error(`Email notification could not load place details (${event}).`);
          return false;
        }
        const day = new Date(`${date.day}T12:00:00`).toLocaleDateString("en", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        dateSummary = `<p>${escapeHtml(day)} · ${escapeHtml(date.start_time.slice(0, 5))}${date.time_label ? `, ${escapeHtml(date.time_label)}` : ""}${place?.name ? ` · ${escapeHtml(place.name)}` : ""}</p>`;
      }
    }

    const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
    if (!["http:", "https:"].includes(siteUrl.protocol)) {
      console.error(`Email notification skipped (${event}): Site URL must use HTTP or HTTPS.`);
      return false;
    }
    const cornerUrl = escapeHtml(siteUrl.toString());
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [authResult.user.email],
        subject: "A little update from Our little corner",
        html: `<div style="font-family:Arial,sans-serif;color:#3d2a33"><p>${eventCopy[event]}</p>${dateSummary}<p><a href="${cornerUrl}">Open our corner</a></p></div>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error(`Email notification delivery failed (${event}): Resend returned HTTP ${response.status}.`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      `Email notification delivery failed (${event}):`,
      error instanceof Error ? error.message : "Unexpected email service error.",
    );
    return false;
  }
}
