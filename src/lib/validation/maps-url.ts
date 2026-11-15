// Hard rule 1: no Google Maps API. A place is typed by hand and a Maps link is only a link.
// A pasted link is opened by the partner, so only these hosts are accepted:
//   https://www.google.com/maps...   https://maps.google.com...
//   https://maps.app.goo.gl...       https://goo.gl/maps...
// The same rule is repeated as a CHECK constraint on places.maps_url in the database.
import { z } from "zod";

export function isAllowedMapsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password || u.port) return false;

  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  const underMaps = path === "/maps" || path.startsWith("/maps/");

  switch (host) {
    case "www.google.com":
    case "goo.gl":
      return underMaps;
    case "maps.google.com":
    case "maps.app.goo.gl":
      return true;
    default:
      return false;
  }
}

/** A required, safe Maps link. Returns the normalised URL. */
export const mapsUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(isAllowedMapsUrl, { message: "Use a link from Google Maps." })
  .transform((v) => new URL(v).href);

/** Optional: empty text becomes null. */
export const optionalMapsUrlSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(mapsUrlSchema.nullable());

type PlaceLinkInput = { name: string; address?: string | null; maps_url?: string | null };

/** Where the "Open in Google Maps" button goes. */
export function mapsOpenUrl(place: PlaceLinkInput): string {
  if (place.maps_url && isAllowedMapsUrl(place.maps_url)) return place.maps_url;
  const query = [place.name, place.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Spread these onto every external link: <a href={...} {...EXTERNAL_LINK_PROPS}> */
export const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;
