export { client } from "./client"
export type { JobOffer, JobType, JobField, WorkMode } from "./job-offers"
export {
  fetchJobOffers,
  fetchJobOffer,
  fetchMyJobOffers,
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
  EVENT_CATEGORIES,
} from "./events"
export type { MapLocation } from "./locations"
export { fetchLocations } from "./locations"
export type { StudentGroup } from "./student-groups"
export { fetchStudentGroups } from "./student-groups"
export type { MensaMeal } from "./mensa"
export { fetchMensaMeals } from "./mensa"

const _threshold = parseInt(process.env.REPORT_WARNING_THRESHOLD ?? "3", 10)
export const REPORT_WARNING_THRESHOLD = Number.isNaN(_threshold) ? 3 : _threshold
