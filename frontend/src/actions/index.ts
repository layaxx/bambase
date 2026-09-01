import { cron } from "./cron"
import { events } from "./events"
import { jobs } from "./jobs"
import { locations } from "./locations"
import { reports } from "./reports"
import { studentGroups } from "./student-groups"
import { users } from "./users"

export const server = { cron, events, jobs, locations, reports, studentGroups, users }
