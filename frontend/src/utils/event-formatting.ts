/**
 * Formats an ISO datetime string as a long date+time string.
 * Example (de-DE): "Mittwoch, 15. April, 10:30 Uhr"
 */
export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Formats an ISO datetime string as a time-only string.
 * Example (de-DE): "10:30 Uhr"
 */
export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  })
}
