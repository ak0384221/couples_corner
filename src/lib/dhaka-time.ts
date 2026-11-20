export const DHAKA_TIME_ZONE = "Asia/Dhaka";

export function formatDhakaTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DHAKA_TIME_ZONE,
  }).format(new Date(value));
}
