/** Example (de-DE): "Mittwoch, 15. April" */
export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

/** Example (de-DE): "10:30 Uhr" */
export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  })
}
