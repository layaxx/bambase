import type { JobOffer } from "./api/job-offers"

export function formatJobLocation(
  job: JobOffer,
  labels: { remote: string; hybrid: string }
): string {
  if (job.work_mode === "remote") {
    return labels.remote
  }

  if (job.work_mode === "hybrid") {
    return `${job.location} (${labels.hybrid})`
  }

  return `${job.location}`
}

const DAY = 24 * 60 * 60

/**
 * [unit, its length in seconds, the distance from which the next unit takes over]. The limits
 * are the ones of dayjs's fromNow. They sit below each rollover point, thus rounding never gives
 * "vor 60 Minuten" or "vor 24 Stunden".
 */
const UNITS: [Intl.RelativeTimeFormatUnit, number, number][] = [
  ["second", 1, 45],
  ["minute", 60, 45 * 60],
  ["hour", 60 * 60, 22 * 60 * 60],
  ["day", DAY, 26 * DAY],
  ["month", 30 * DAY, 320 * DAY],
  ["year", 365 * DAY, Infinity],
]

const formatters = new Map<string, Intl.RelativeTimeFormat>()

/**
 * "vor 3 Tagen", "in 2 Stunden". `numeric: "always"`, because a word like "gestern" names a
 * calendar day, which a rounded distance does not tell. An invalid date gives "".
 */
export function formatRelativeDate(date: string | Date, locale: string): string {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  if (Number.isNaN(seconds)) return ""
  const [unit, size] = UNITS.find(([, , limit]) => Math.abs(seconds) < limit) ?? UNITS[0]
  let formatter = formatters.get(locale)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "always" })
    formatters.set(locale, formatter)
  }
  return formatter.format(Math.round(seconds / size), unit)
}
