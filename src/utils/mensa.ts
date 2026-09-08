import type { Dayjs } from "dayjs"
import type { MensaMeal } from "./api/mensa"

export const MENSA_CLOSING_HOUR = 15

/**
 * Returns the day whose mensa meals the homepage card must show at the time `now`.
 *
 * - A weekday before 15:00 → today
 * - A weekday at or after 15:00 → the next weekday (Friday goes to Monday)
 * - Saturday → Monday (plus 2 days)
 * - Sunday → Monday (plus 1 day)
 */
export function getRelevantDay(now: Dayjs): Dayjs {
  const dow = now.day() // 0 = Sunday, 6 = Saturday

  if (dow >= 1 && dow <= 5) {
    if (now.hour() < MENSA_CLOSING_HOUR) return now
    return now.add(dow === 5 ? 3 : 1, "day") // Friday → Monday, else +1
  }

  if (dow === 6) return now.add(2, "day") // Saturday → Monday
  return now.add(1, "day") // Sunday → Monday
}

export type WeekdayEntry = {
  type: "weekday"
  id: string
  heading: string
  meals: MensaMeal[]
}

export type WeekendEntry = {
  type: "weekend"
  id: string
  heading: string
}

export type DayEntry = WeekdayEntry | WeekendEntry

export type GroupLabels = {
  today: string
  tomorrow: string
  /** Indexed 0 (Sunday) through 6 (Saturday) */
  weekdays: readonly string[]
  weekendHeading: (saturdayFormatted: string, sundayFormatted: string) => string
  dateLocale: string
}

/**
 * Groups an ordered array of { day, meals } entries into DayEntry records for the mensa page.
 *
 * - A Saturday entry and the Sunday entry that follows it become one WeekendEntry.
 * - A single weekend day also becomes one WeekendEntry.
 * - A weekday entry at index 0 gets the "today" label, and one at index 1 gets "tomorrow".
 *   Each other weekday entry gets the name of its weekday.
 */
export function groupMealsByDay(
  mealsByDay: Array<{ day: Dayjs; meals: MensaMeal[] }>,
  labels: GroupLabels
): DayEntry[] {
  function formatDate(d: Dayjs): string {
    return d.toDate().toLocaleDateString(labels.dateLocale, { day: "numeric", month: "long" })
  }

  const grouped: DayEntry[] = []
  let i = 0

  while (i < mealsByDay.length) {
    const { day, meals } = mealsByDay[i]
    const dow = day.day()
    const nextDow = i + 1 < mealsByDay.length ? mealsByDay[i + 1].day.day() : -1

    if (dow === 6 && nextDow === 0) {
      const heading = labels.weekendHeading(formatDate(day), formatDate(mealsByDay[i + 1].day))
      grouped.push({ type: "weekend", id: day.format("YYYY-MM-DD"), heading })
      i += 2
    } else if (dow === 0 || dow === 6) {
      grouped.push({
        type: "weekend",
        id: day.format("YYYY-MM-DD"),
        heading: `${labels.weekdays[dow]}, ${formatDate(day)}`,
      })
      i++
    } else {
      const label = i === 0 ? labels.today : i === 1 ? labels.tomorrow : labels.weekdays[dow]
      grouped.push({
        type: "weekday",
        id: day.format("YYYY-MM-DD"),
        heading: `${label}, ${formatDate(day)}`,
        meals,
      })
      i++
    }
  }

  return grouped
}
