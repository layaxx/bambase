import type { Event } from "./api/events"

/** Example (de-DE): "Mittwoch, 15. April" */
export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

/** Example (de-DE): "15. April 2026" */
export function formatLongDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/** Example (de-DE): "10:30 Uhr" */
export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Converts an ISO datetime to the value format of a datetime-local input, in server time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The `initialValues` of `EventForm` for editing `event`. */
export function eventFormValues(event: Event) {
  const locationType: "linked" | "custom" | "none" = event.map_location
    ? "linked"
    : event.custom_location
      ? "custom"
      : "none"
  return {
    title: event.title,
    organizer: event.organizer,
    start: toLocalInput(event.start),
    end: toLocalInput(event.end),
    category: event.category,
    description: event.description,
    external_url: event.external_url,
    locationType,
    map_location_id: event.map_location?.id,
    custom_location_name: event.custom_location?.name,
    custom_location_address: event.custom_location?.address,
    custom_location_city: event.custom_location?.city,
  }
}
