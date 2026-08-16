export type { ApiResult } from "./types"
export type {
  JobOffer,
  JobType,
  JobField,
  WorkMode,
  JobOffersFilter,
  JobOfferPage,
} from "./job-offers"
export {
  fetchJobOffers,
  fetchJobOffersPaginated,
  fetchJobOffer,
  fetchMyJobOffers,
  fetchSubmittedJobOffers,
  fetchRecentlyModeratedJobOffers,
  JOB_TYPES,
  JOB_FIELDS,
  WORK_MODES,
} from "./job-offers"
export type { Event, EventMapLocation, EventCustomLocation, EventCategory } from "./events"
export {
  fetchEvents,
  fetchOngoingOrUpcomingEvents,
  fetchEvent,
  fetchUpcomingMapEvents,
  fetchMyEvents,
  fetchAllPublishedEventSlugs,
  fetchEventForAdmin,
  fetchAllEventsForAdmin,
  EVENT_CATEGORIES,
} from "./events"
export type { MapLocation } from "./locations"
export {
  fetchLocations,
  fetchLocationForAdmin,
  fetchAllLocationsForAdmin,
  LOCATION_CATEGORIES,
} from "./locations"
export type { StudentGroup } from "./student-groups"
export { fetchStudentGroups } from "./student-groups"
export type { MensaMeal } from "./mensa"
export { fetchMensaMeals, fetchMensaMealsRange } from "./mensa"
export type { CronJobKey } from "@/utils/cron-tracking"
export type { CronJobStatus, CronJobLastRun } from "./cron-jobs"
export { fetchCronJobStatuses } from "./cron-jobs"

const _threshold = parseInt(process.env.REPORT_WARNING_THRESHOLD ?? "3", 10)
export const REPORT_WARNING_THRESHOLD = Number.isNaN(_threshold) ? 3 : _threshold
