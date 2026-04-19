export { strapiUrl, client } from "./client"
export type { JobOffer } from "./job-offers"
export { fetchJobOffers, fetchJobOffer, fetchMyJobOffers } from "./job-offers"
export type { Event, EventMapLocation, EventCustomLocation } from "./events"
export { fetchEvents, fetchEvent, fetchUpcomingMapEvents, fetchMyEvents } from "./events"
export type { MapLocation } from "./locations"
export { fetchLocations } from "./locations"
export type { StudentGroup } from "./student-groups"
export { fetchStudentGroups } from "./student-groups"
export type { MensaMeal } from "./mensa"
export { fetchMensaMeals } from "./mensa"

const _threshold = parseInt(import.meta.env.REPORT_WARNING_THRESHOLD ?? "3", 10)
export const REPORT_WARNING_THRESHOLD = Number.isNaN(_threshold) ? 3 : _threshold
