import { z } from "zod";
import { EXPLORE_CATEGORIES } from "@/lib/explore-categories";
import { t } from "@/lib/text";
import { optionalMapsUrlSchema } from "./maps-url";

const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export const profileSchema = z.object({
  name: requiredText(60, "Name"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3–20 letters, numbers, or underscores."),
  bio: z.string().trim().max(120, "Bio must be 120 characters or fewer."),
  birthDay: z.number().int().min(1).max(31).nullable(),
  birthMonth: z.number().int().min(1).max(12).nullable(),
});

export const dateSchema = z.object({
  name: z.string().trim().max(80),
  mood: requiredText(40, "Choose a mood"),
  activity: requiredText(40, "Choose an activity"),
  placeId: z.string().uuid().optional(),
  placeName: z.string().trim().max(120),
  address: z.string().trim().max(300),
  mapsUrl: optionalMapsUrlSchema,
  savePlace: z.boolean(),
  food: requiredText(40, "Choose something to eat"),
  day: z.iso.date("Choose a valid date."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time."),
  timeLabel: requiredText(40, "Choose a time of day"),
  creatorOutfitStyle: z.string().trim().max(40),
  creatorOutfitColor: z.string().trim().max(40),
  partnerOutfitStyle: z.string().trim().max(40),
  partnerOutfitColor: z.string().trim().max(40),
});

export const albumSchema = z.object({
  title: requiredText(80, "Album name"),
  albumDate: z.iso.date("Choose a valid album date."),
});

export const importantDateSchema = z.object({
  what: z.string().trim().min(1, t.importantDates.required).max(80, t.importantDates.tooLong),
  date: z.iso.date(t.importantDates.invalidDate),
});

export const explorePostSchema = z.object({
  category: z.enum(EXPLORE_CATEGORIES),
  content: z.string().trim().min(1, t.explore.reminderRequired).max(500, t.explore.postTooLong),
});
