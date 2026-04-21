import type { JobOffer } from "./api"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import "dayjs/locale/de"
dayjs.extend(relativeTime)

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

export function formatJobOfferDate(dateString: string, locale: string): string {
  return dayjs(dateString).locale(locale).fromNow()
}
