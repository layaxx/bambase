import type { MensaMeal } from "./api/mensa"
import { addDays, isoDay } from "./dates"

export const MENSA_CLOSING_HOUR = 15

/**
 * Returns the day whose mensa meals the homepage card must show at the time `now`.
 *
 * - A weekday before 15:00 → today
 * - A weekday at or after 15:00 → the next weekday (Friday goes to Monday)
 * - Saturday → Monday (plus 2 days)
 * - Sunday → Monday (plus 1 day)
 */
export function getRelevantDay(now: Date): Date {
  const dow = now.getDay() // 0 = Sunday, 6 = Saturday

  if (dow >= 1 && dow <= 5) {
    if (now.getHours() < MENSA_CLOSING_HOUR) return new Date(now)
    return addDays(now, dow === 5 ? 3 : 1) // Friday → Monday, else +1
  }

  if (dow === 6) return addDays(now, 2) // Saturday → Monday
  return addDays(now, 1) // Sunday → Monday
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
  mealsByDay: Array<{ day: Date; meals: MensaMeal[] }>,
  labels: GroupLabels
): DayEntry[] {
  function formatDate(d: Date): string {
    return d.toLocaleDateString(labels.dateLocale, { day: "numeric", month: "long" })
  }

  const grouped: DayEntry[] = []
  let i = 0

  while (i < mealsByDay.length) {
    const { day, meals } = mealsByDay[i]
    const dow = day.getDay()
    const nextDow = i + 1 < mealsByDay.length ? mealsByDay[i + 1].day.getDay() : -1

    if (dow === 6 && nextDow === 0) {
      const heading = labels.weekendHeading(formatDate(day), formatDate(mealsByDay[i + 1].day))
      grouped.push({ type: "weekend", id: isoDay(day), heading })
      i += 2
    } else if (dow === 0 || dow === 6) {
      grouped.push({
        type: "weekend",
        id: isoDay(day),
        heading: `${labels.weekdays[dow]}, ${formatDate(day)}`,
      })
      i++
    } else {
      const label = i === 0 ? labels.today : i === 1 ? labels.tomorrow : labels.weekdays[dow]
      grouped.push({
        type: "weekday",
        id: isoDay(day),
        heading: `${label}, ${formatDate(day)}`,
        meals,
      })
      i++
    }
  }

  return grouped
}
