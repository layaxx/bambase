import type { Dayjs } from "dayjs"
import type { MensaMeal } from "./api"

export const MENSA_CLOSING_HOUR = 15
export const MENSA_CLOSING_MINUTE = 0

/**
 * Given the current time, returns the day whose mensa meals are most relevant
 * to show on the homepage card.
 *
 * - Weekdays before 15:00 → today
 * - Weekdays at/after 15:00 → next weekday (Friday wraps to Monday)
 * - Saturday → Monday (+2 days)
 * - Sunday  → Monday (+1 day)
 */
export function getRelevantDay(now: Dayjs): Dayjs {
  const dow = now.day() // 0 = Sunday, 6 = Saturday

  if (dow >= 1 && dow <= 5) {
    const closed =
      now.hour() > MENSA_CLOSING_HOUR ||
      (now.hour() === MENSA_CLOSING_HOUR && now.minute() >= MENSA_CLOSING_MINUTE)
    if (!closed) return now
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
 * Groups an ordered array of { day, meals } entries into DayEntry records
 * suitable for rendering on the mensa page.
 *
 * - Consecutive Saturday+Sunday pairs are merged into a single WeekendEntry.
 * - Isolated weekend days become a single WeekendEntry.
 * - The first weekday entry gets the "today" label, the second gets "tomorrow",
 *   the rest get their weekday name — matching the index in the input array.
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
