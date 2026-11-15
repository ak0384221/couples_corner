"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_DELIVERY_PAUSED, sendAppEmail } from "@/lib/notifications/email";
import type { ActionState } from "@/lib/action-state";
import { albumSchema, appearanceSchema, closetItemSchema, dateSchema, profileSchema } from "@/lib/validation/forms";

function value(formData: FormData, key: string): string {
  const field = formData.get(key);
  return typeof field === "string" ? field : "";
}

async function uploadAvatar(
  formData: FormData,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return null;
  if (photo.size > 1_048_576) throw new Error("Choose a compressed photo no larger than 1 MB.");
  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (photo.type !== "image/jpeg" || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Profile photos must be re-saved as JPEG before upload.");
  }
  const path = `avatars/${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, bytes, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Profile photo upload failed: ${error.message}`);
  return path;
}

function nullableNumber(input: string): number | null {
  return input === "" ? null : Number(input);
}

function fail(message: string): ActionState {
  return { error: message };
}

function databaseMessage(message: string): string {
  if (/duplicate key|unique constraint/i.test(message)) return "That username or request is already in use.";
  if (/maps_url|Google Maps/i.test(message)) return "Use a valid Google Maps link, or leave the link blank.";
  if (/not_authenticated|JWT/i.test(message)) return "Your session expired. Please sign in again.";
  if (/not paired|couple/i.test(message)) return "Pair your accounts before using this feature.";
  return "We could not save that just now. Please check the details and try again.";
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Could not sign out: ${error.message}`);
  redirect("/login");
}

export async function signOutEverywhere() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw new Error(`Could not sign out of all devices: ${error.message}`);
  redirect("/login");
}

export async function saveProfile(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: value(formData, "name"),
    username: value(formData, "username"),
    bio: value(formData, "bio"),
    birthDay: nullableNumber(value(formData, "birth_day")),
    birthMonth: nullableNumber(value(formData, "birth_month")),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your profile details.");
  if ((parsed.data.birthDay === null) !== (parsed.data.birthMonth === null)) {
    return fail("Choose both the day and month for your birthday.");
  }

  const supabase = await createClient();
  let photoPath: string | null;
  try {
    photoPath = await uploadAvatar(formData, user.id, supabase);
  } catch (error) {
    if (error instanceof Error) return fail(error.message);
    throw error;
  }
  const { error } = await supabase.from("profiles").insert({
      id: user.id,
      name: parsed.data.name,
      username: parsed.data.username,
      bio: parsed.data.bio || null,
      birth_day: parsed.data.birthDay,
      birth_month: parsed.data.birthMonth,
      ...(photoPath ? { photo_path: photoPath } : {}),
    });
  if (error) {
    if (photoPath) {
      const { error: cleanupError } = await supabase.storage.from("photos").remove([photoPath]);
      if (cleanupError) throw new Error(`Profile save failed (${error.message}); temporary avatar cleanup failed (${cleanupError.message}).`);
    }
    return fail(databaseMessage(error.message));
  }
  revalidatePath("/");
  redirect("/pair?optional=1");
}

export async function sendPairRequest(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const receiverId = z.string().uuid().safeParse(value(formData, "receiver_id"));
  if (!receiverId.success) return fail("Choose a valid profile first.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_pair_request", { p_receiver_id: receiverId.data });
  if (error) return fail(databaseMessage(error.message));
  const emailSent = await sendAppEmail(receiverId.data, "pair_request_received");
  revalidatePath("/pair");
  redirect(`/pair?sent=1${emailSent ? "" : "&email=not-sent"}`);
}

export async function respondPairRequest(formData: FormData) {
  const requestId = z.string().uuid().safeParse(value(formData, "request_id"));
  const acceptValue = value(formData, "accept");
  if (acceptValue !== "true" && acceptValue !== "false") throw new Error("Choose whether to accept or decline the request.");
  const accept = acceptValue === "true";
  if (!requestId.success) throw new Error("Invalid pairing request.");
  const supabase = await createClient();
  const { data: coupleId, error } = await supabase.rpc("respond_pair_request", {
    p_request_id: requestId.data,
    p_accept: accept,
  });
  if (error) throw new Error(`Could not respond to pairing request: ${databaseMessage(error.message)}`);
  if (accept && coupleId) {
    const { data: members, error: membersError } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", coupleId);
    if (membersError) throw new Error(`Pairing succeeded, but notification recipients could not be loaded: ${membersError.message}`);
    await Promise.all((members ?? []).map((member) => sendAppEmail(member.user_id, "paired")));
  }
  revalidatePath("/");
  revalidatePath("/pair");
  redirect(accept ? "/" : "/pair?declined=1");
}

export async function createDate(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const raw = {
    name: value(formData, "name"),
    mood: value(formData, "mood"),
    activity: value(formData, "activity"),
    placeId: value(formData, "place_id") || undefined,
    placeName: value(formData, "place_name"),
    address: value(formData, "address"),
    mapsUrl: value(formData, "maps_url"),
    savePlace: value(formData, "save_place") === "true",
    food: value(formData, "food"),
    day: value(formData, "day"),
    startTime: value(formData, "start_time"),
    timeLabel: value(formData, "time_label"),
    creatorOutfitStyle: value(formData, "creator_outfit_style"),
    creatorOutfitColor: value(formData, "creator_outfit_color"),
    partnerOutfitStyle: value(formData, "partner_outfit_style"),
    partnerOutfitColor: value(formData, "partner_outfit_color"),
  };
  const parsed = dateSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your date plan.");
  if (!parsed.data.placeId && !parsed.data.placeName) return fail("Name the place for your date.");
  await requireUser();
  const supabase = await createClient();
  const { data: partnerId, error: partnerError } = await supabase.rpc("current_partner_id");
  if (partnerError || !partnerId) return fail("Pair your accounts before planning a date.");
  let placeId = parsed.data.placeId;
  let createdPlaceId: string | null = null;
  if (placeId) {
    const { data: place, error } = await supabase.from("places").select("id").eq("id", placeId).maybeSingle();
    if (error) return fail(databaseMessage(error.message));
    if (!place) return fail("That saved place is no longer available.");
  } else {
    const { data: place, error } = await supabase
      .from("places")
      .insert({
        name: parsed.data.placeName,
        address: parsed.data.address || null,
        maps_url: parsed.data.mapsUrl,
        saved: parsed.data.savePlace,
      })
      .select("id")
      .single();
    if (error || !place) return fail(databaseMessage(error?.message ?? "Place was not saved."));
    placeId = place.id;
    createdPlaceId = place.id;
  }

  const { data: date, error } = await supabase
    .from("dates")
    .insert({
      name: parsed.data.name || null,
      mood: parsed.data.mood,
      activity: parsed.data.activity,
      place_id: placeId,
      food: parsed.data.food,
      day: parsed.data.day,
      start_time: parsed.data.startTime,
      time_label: parsed.data.timeLabel,
      creator_outfit_style: parsed.data.creatorOutfitStyle || null,
      creator_outfit_color: parsed.data.creatorOutfitColor || null,
      partner_outfit_style: parsed.data.partnerOutfitStyle || null,
      partner_outfit_color: parsed.data.partnerOutfitColor || null,
    })
    .select("id")
    .single();
  if (error || !date) {
    if (createdPlaceId && !parsed.data.savePlace) {
      const { error: cleanupError } = await supabase.from("places").delete().eq("id", createdPlaceId);
      if (cleanupError) {
        return fail(`Date was not saved (${error?.message ?? "unknown error"}); temporary place cleanup failed (${cleanupError.message}).`);
      }
    }
    return fail(databaseMessage(error?.message ?? "Date was not saved."));
  }
  const emailSent = await sendAppEmail(partnerId, "date_requested", date.id);
  revalidatePath("/");
  revalidatePath("/notifications");
  redirect(`/dates/${date.id}${emailSent ? "" : "?email=not-sent"}`);
}

export async function updateDate(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const dateId = z.string().uuid().safeParse(value(formData, "date_id"));
  const day = z.iso.date().safeParse(value(formData, "day"));
  const startTime = value(formData, "start_time");
  if (!dateId.success || !day.success || !/^\d{2}:\d{2}$/.test(startTime)) {
    return fail("Check the date and time.");
  }
  const user = await requireUser();
  const supabase = await createClient();
  const { data: date, error: dateError } = await supabase
    .from("dates")
    .select("created_by")
    .eq("id", dateId.data)
    .maybeSingle();
  if (dateError || !date) return fail("No pending date request was available to edit.");
  if (date.created_by !== user.id) return fail("Only the person who planned this date can edit it.");
  const { data, error } = await supabase
    .from("dates")
    .update({
      name: value(formData, "name").slice(0, 80) || null,
      day: day.data,
      start_time: startTime,
      time_label: value(formData, "time_label").slice(0, 40),
    })
    .eq("id", dateId.data)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return fail(databaseMessage(error.message));
  if (!data) return fail("No pending date request was available to edit.");
  const { data: partnerId, error: partnerError } = await supabase.rpc("current_partner_id");
  if (partnerError) return fail("Your update was saved, but we could not prepare its email notification.");
  if (partnerId) await sendAppEmail(partnerId, "date_changed", dateId.data);
  revalidatePath("/");
  revalidatePath(`/dates/${dateId.data}`);
  return { error: null, success: "Your date request is updated." };
}

export async function reviseDate(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const dateId = z.string().uuid().safeParse(value(formData, "date_id"));
  const day = z.iso.date().safeParse(value(formData, "day"));
  const startTime = value(formData, "start_time");
  const name = value(formData, "name").slice(0, 80);
  const timeLabel = value(formData, "time_label").slice(0, 40);
  if (!dateId.success || !day.success || !/^\d{2}:\d{2}$/.test(startTime)) {
    return fail("Check the date and time.");
  }
  const supabase = await createClient();
  await requireUser();
  const { data: partnerId, error: partnerError } = await supabase.rpc("current_partner_id");
  if (partnerError || !partnerId) return fail("Could not verify your partner.");
  const { error } = await supabase.rpc("revise_date_request", {
    p_date_id: dateId.data,
    p_name: name,
    p_day: day.data,
    p_start_time: startTime,
    p_time_label: timeLabel,
  });
  if (error) return fail(databaseMessage(error.message));
  await sendAppEmail(partnerId, "date_changed", dateId.data);
  revalidatePath("/");
  revalidatePath(`/dates/${dateId.data}`);
  revalidatePath("/notifications");
  return { error: null, success: "Your updated date request is on its way." };
}

export async function suggestDateChange(formData: FormData) {
  const dateId = z.string().uuid().safeParse(value(formData, "date_id"));
  if (!dateId.success) throw new Error("Invalid date request.");
  const supabase = await createClient();
  const { data: date, error: dateError } = await supabase.from("dates").select("created_by").eq("id", dateId.data).maybeSingle();
  if (dateError || !date) throw new Error("Date request not found.");
  const { error } = await supabase.rpc("suggest_date_change", { p_date_id: dateId.data });
  if (error) throw new Error(`Could not suggest a date change: ${databaseMessage(error.message)}`);
  await sendAppEmail(date.created_by, "date_changed", dateId.data);
  revalidatePath("/");
  revalidatePath(`/dates/${dateId.data}`);
  revalidatePath("/notifications");
  redirect(`/dates/${dateId.data}`);
}

export async function confirmDate(formData: FormData) {
  const dateId = z.string().uuid().safeParse(value(formData, "date_id"));
  if (!dateId.success) throw new Error("Invalid date request.");
  const supabase = await createClient();
  const { data: date, error: dateError } = await supabase.from("dates").select("created_by").eq("id", dateId.data).maybeSingle();
  if (dateError || !date) throw new Error("Date request not found.");
  const { error } = await supabase.rpc("confirm_date", { p_date_id: dateId.data });
  if (error) throw new Error(`Could not confirm the date: ${databaseMessage(error.message)}`);
  const emailSent = await sendAppEmail(date.created_by, "date_confirmed", dateId.data);
  revalidatePath("/");
  revalidatePath(`/dates/${dateId.data}`);
  revalidatePath("/notifications");
  redirect(`/dates/${dateId.data}${emailSent ? "" : "?email=not-sent"}`);
}

export async function cancelDate(formData: FormData) {
  const dateId = z.string().uuid().safeParse(value(formData, "date_id"));
  if (!dateId.success) throw new Error("Invalid date request.");
  const supabase = await createClient();
  const { data: partnerId, error: partnerError } = await supabase.rpc("current_partner_id");
  if (partnerError) throw new Error("Could not verify the date partner.");
  const { error } = await supabase.rpc("cancel_date", { p_date_id: dateId.data });
  if (error) throw new Error(`Could not cancel the date: ${databaseMessage(error.message)}`);
  if (partnerId) await sendAppEmail(partnerId, "date_cancelled", dateId.data);
  revalidatePath("/");
  revalidatePath(`/dates/${dateId.data}`);
  revalidatePath("/notifications");
  redirect("/");
}

export async function createAlbum(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = albumSchema.safeParse({
    title: value(formData, "title"),
    albumDate: value(formData, "album_date"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the album details.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("albums")
    .insert({ title: parsed.data.title, album_date: parsed.data.albumDate })
    .select("id")
    .single();
  if (error || !data) return fail(databaseMessage(error?.message ?? "Album was not created."));
  revalidatePath("/memories");
  redirect(`/memories/${data.id}`);
}

async function getCoupleId(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("couple_members").select("couple_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Could not verify couple membership: ${error.message}`);
  if (!data) throw new Error("Pair your accounts before adding photos.");
  return data.couple_id;
}

async function uploadJpeg(formData: FormData, folder: "albums" | "closet") {
  const user = await requireUser();
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size < 1 || photo.size > 1_048_576) {
    throw new Error("Choose a compressed photo no larger than 1 MB.");
  }
  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (photo.type !== "image/jpeg" || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Photos must be re-saved as JPEG before upload.");
  }
  const coupleId = await getCoupleId(user.id);
  const path = `${coupleId}/${folder}/${crypto.randomUUID()}.jpg`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from("photos").upload(path, bytes, {
    contentType: "image/jpeg",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return { supabase, path, size: photo.size };
}

export async function uploadMemoryPhoto(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const albumId = z.string().uuid().safeParse(value(formData, "album_id"));
  const caption = value(formData, "caption").trim().slice(0, 200);
  if (!albumId.success) return fail("Choose an album for this photo.");
  await requireUser();
  const supabaseForPartner = await createClient();
  const { data: partnerId, error: partnerError } = await supabaseForPartner.rpc("current_partner_id");
  if (partnerError || !partnerId) return fail("Pair your accounts before adding shared memories.");
  let uploaded: Awaited<ReturnType<typeof uploadJpeg>>;
  try {
    uploaded = await uploadJpeg(formData, "albums");
  } catch (error) {
    if (error instanceof Error) return fail(error.message);
    throw error;
  }
  const { supabase, path, size } = uploaded;
  const { error } = await supabase.from("photos").insert({
    album_id: albumId.data,
    storage_path: path,
    caption: caption || null,
    size_bytes: size,
  });
  if (error) {
    const { error: cleanupError } = await supabase.storage.from("photos").remove([path]);
    if (cleanupError) return fail(`Photo record failed (${error.message}); temporary photo cleanup failed (${cleanupError.message}).`);
    return fail(`Photo record failed: ${error.message}`);
  }
  await sendAppEmail(partnerId, "photos_added");
  revalidatePath(`/memories/${albumId.data}`);
  revalidatePath("/memories");
  revalidatePath("/notifications");
  redirect(`/memories/${albumId.data}`);
}

export async function addClosetItem(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = closetItemSchema.safeParse({
    kind: value(formData, "kind"),
    name: value(formData, "name"),
    mainColor: value(formData, "main_color"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the closet item.");
  await requireUser();
  let uploaded: Awaited<ReturnType<typeof uploadJpeg>>;
  try {
    uploaded = await uploadJpeg(formData, "closet");
  } catch (error) {
    if (error instanceof Error) return fail(error.message);
    throw error;
  }
  const { supabase, path } = uploaded;
  const { error } = await supabase.from("closet_items").insert({
    photo_path: path,
    kind: parsed.data.kind,
    name: parsed.data.name,
    main_color: parsed.data.mainColor || null,
  });
  if (error) {
    const { error: cleanupError } = await supabase.storage.from("photos").remove([path]);
    if (cleanupError) return fail(`Closet item failed (${error.message}); temporary photo cleanup failed (${cleanupError.message}).`);
    return fail(`Closet item failed: ${error.message}`);
  }
  revalidatePath("/closet");
  redirect("/closet");
}

export async function sendClosetPreference(formData: FormData) {
  const dateId = z.string().uuid().safeParse(value(formData, "date_id"));
  if (!dateId.success) throw new Error("Choose a date.");
  const creatorItems = z.array(z.string().uuid()).max(8).safeParse(
    formData.getAll("creator_item_id").filter((id): id is string => typeof id === "string"),
  );
  const partnerItems = z.array(z.string().uuid()).max(8).safeParse(
    formData.getAll("partner_item_id").filter((id): id is string => typeof id === "string"),
  );
  if (!creatorItems.success || !partnerItems.success) throw new Error("Choose no more than eight pieces per person.");
  if (creatorItems.data.length + partnerItems.data.length === 0) throw new Error("Choose at least one closet item.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_closet_preference", {
    p_date_id: dateId.data,
    p_creator_item_ids: creatorItems.data,
    p_partner_item_ids: partnerItems.data,
  });
  if (error) throw new Error(`Could not send outfit preference: ${databaseMessage(error.message)}`);
  const { data: partnerId, error: partnerError } = await supabase.rpc("current_partner_id");
  if (partnerError) throw new Error("Outfit preference saved, but we could not notify your partner.");
  if (partnerId) await sendAppEmail(partnerId, "closet_preference_sent");
  revalidatePath("/closet");
  revalidatePath("/notifications");
  redirect("/closet?sent=1");
}

export async function respondClosetPreference(formData: FormData) {
  const preferenceId = z.string().uuid().safeParse(value(formData, "preference_id"));
  if (!preferenceId.success) throw new Error("Invalid outfit request.");
  const supabase = await createClient();
  const { data: preference, error: preferenceError } = await supabase
    .from("closet_preferences")
    .select("created_by")
    .eq("id", preferenceId.data)
    .maybeSingle();
  if (preferenceError || !preference) throw new Error("Outfit request not found.");
  const answer = value(formData, "answer");
  if (answer !== "accept" && answer !== "change") throw new Error("Choose whether to accept or change the outfit request.");
  let error;
  if (answer === "accept") {
    ({ error } = await supabase.rpc("accept_closet_preference", { p_preference_id: preferenceId.data }));
  } else {
    const replacementIds = z.array(z.string().uuid()).max(8).safeParse(
      formData.getAll("partner_item_id").filter((id): id is string => typeof id === "string"),
    );
    if (!replacementIds.success || replacementIds.data.length === 0) throw new Error("Choose between one and eight replacement pieces.");
    ({ error } = await supabase.rpc("change_closet_preference", {
      p_preference_id: preferenceId.data,
      p_partner_item_ids: replacementIds.data,
    }));
  }
  if (error) throw new Error(`Could not update outfit preference: ${databaseMessage(error.message)}`);
  await sendAppEmail(
    preference.created_by,
    answer === "accept" ? "closet_preference_accepted" : "closet_preference_changed",
  );
  revalidatePath("/closet");
  revalidatePath("/notifications");
  redirect("/closet");
}

export async function updateProfileSettings(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse({
    name: value(formData, "name"),
    username: value(formData, "username"),
    bio: value(formData, "bio"),
    birthDay: nullableNumber(value(formData, "birth_day")),
    birthMonth: nullableNumber(value(formData, "birth_month")),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your profile details.");
  if ((parsed.data.birthDay === null) !== (parsed.data.birthMonth === null)) return fail("Choose both birthday fields or leave both blank.");
  const user = await requireUser();
  const supabase = await createClient();
  let photoPath: string | null;
  try {
    photoPath = await uploadAvatar(formData, user.id, supabase);
  } catch (error) {
    if (error instanceof Error) return fail(error.message);
    throw error;
  }
  const { error } = await supabase.from("profiles").update({
    name: parsed.data.name,
    username: parsed.data.username,
    bio: parsed.data.bio || null,
    birth_day: parsed.data.birthDay,
    birth_month: parsed.data.birthMonth,
    ...(photoPath ? { photo_path: photoPath } : {}),
  }).eq("id", user.id);
  if (error) {
    if (photoPath) {
      const { error: cleanupError } = await supabase.storage.from("photos").remove([photoPath]);
      if (cleanupError) throw new Error(`Profile save failed (${error.message}); temporary avatar cleanup failed (${cleanupError.message}).`);
    }
    return fail(databaseMessage(error.message));
  }
  revalidatePath("/us");
  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  redirect("/profile?updated=1");
}

export async function saveAppearance(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = appearanceSchema.safeParse({
    theme_mode: value(formData, "theme_mode"),
    theme_font: value(formData, "theme_font"),
    theme_accent: value(formData, "theme_accent"),
    theme_font_color: value(formData, "theme_font_color"),
  });
  if (!parsed.success) return fail("Choose a valid appearance option.");
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return fail(databaseMessage(error.message));
  revalidatePath("/", "layout");
  return { error: null, success: "Appearance saved." };
}

export async function setEmailAlerts(formData: FormData) {
  const user = await requireUser();
  const enabledValue = value(formData, "enabled");
  if (enabledValue !== "true" && enabledValue !== "false") throw new Error("Invalid email preference.");
  const enabled = enabledValue === "true";
  if (enabled && (EMAIL_DELIVERY_PAUSED || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new Error(EMAIL_DELIVERY_PAUSED
      ? "Email alerts are temporarily paused."
      : "Email alerts cannot be enabled until Resend and the Supabase server key are configured.");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ email_alerts: enabled }).eq("id", user.id);
  if (error) throw new Error(`Could not update email preferences: ${error.message}`);
  revalidatePath("/settings");
}

export async function markNotificationRead(formData: FormData) {
  const id = z.string().uuid().safeParse(value(formData, "notification_id"));
  if (!id.success) throw new Error("Invalid notification.");
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id.data);
  if (error) throw new Error(`Could not mark notification as read: ${error.message}`);
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", user.id);
  if (error) throw new Error(`Could not mark notifications as read: ${error.message}`);
  revalidatePath("/notifications");
}

export async function changePassword(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const password = value(formData, "password");
  if (password.length < 12 || password.length > 128) return fail("Use a password between 12 and 128 characters.");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(`Could not change your password: ${error.message}`);
  return { error: null, success: "Password updated." };
}
