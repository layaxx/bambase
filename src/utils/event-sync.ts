import { UnivISClient } from "univis-api"
import he from "he"
import removeMd from "remove-markdown"
import { EventCategory } from "@/generated/prisma/enums"
import prisma from "./prisma"
import { createWithUniqueSlug } from "./slugify"
import { errorMessage } from "./error-message"

const UNIVIS_PREFIX = "univis:"

function parse(str: string): string {
  const decoded = he.decode(str)
  const linkReplaced = decoded.replace(/\[(https?:\/\/\S+)\]\s+\1(?=\s|$)/g, "$1")
  const noMarkdown = removeMd(linkReplaced)

  return noMarkdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const client = new UnivISClient({ domain: "univis.uni-bamberg.de" })

function parseTime(time: string): [number, number, number] {
  const [h = 0, m = 0, s = 0] = time.split(":").map((n) => parseInt(n, 10) || 0)
  return [h, m, s]
}

function toDateTime(date: string, time: string): Date {
  const result = new Date(date)
  result.setHours(...parseTime(time))
  return result
}

export async function syncUnivisEvents() {
  const now = new Date()
  const windowEnd = new Date(now)
  windowEnd.setMonth(windowEnd.getMonth() + 2)

  const start = now.toISOString().split("T")[0]
  const end = windowEnd.toISOString().split("T")[0]

  console.warn(`[univis] Syncing events ${start} -> ${end}`)

  let univisEvents: Awaited<ReturnType<typeof client.getCalendar>>

  try {
    univisEvents = await client.getCalendar({ start, end })
  } catch (error) {
    const message = errorMessage(error)
    console.error(`[univis] Failed to fetch from UniVis: ${message}`)
    throw new Error(`Failed to fetch from UniVis: ${message}`, { cause: error })
  }

  console.warn(`[univis] Received ${univisEvents.length} events`)

  const existing = await prisma.event.findMany({
    where: {
      externalId: { startsWith: UNIVIS_PREFIX },
      end: { gte: now },
    },
    select: { id: true, externalId: true, hidden: true },
    take: 5000,
  })

  const existingMap = new Map(existing.map((e) => [e.externalId as string, e]))

  const seenIds = new Set<string>()

  const results = await Promise.all(
    univisEvents.map(async (event) => {
      const externalId = `${UNIVIS_PREFIX}${event._key}`

      if (
        !event.title ||
        !event.startdate ||
        !event.enddate ||
        !event.starttime ||
        !event.endtime
      ) {
        console.warn(`[univis] Skipping event ${event._key} - missing required fields`)
        return "skipped"
      }

      seenIds.add(externalId)

      const organizer = parse(event.orgname)

      const data = {
        title: parse(event.title) || `Veranstaltung von ${organizer}`,
        description: parse(event.description ?? "") || `Veranstaltung von ${organizer}`,
        category: EventCategory.university,
        start: toDateTime(event.startdate, event.starttime),
        end: toDateTime(event.enddate, event.endtime),
        organizer,
        externalId,
        externalUrl: event.url ?? undefined,
      }

      const match = existingMap.get(externalId)

      if (match) {
        if (match.hidden) return "skipped"

        try {
          await prisma.event.update({ where: { id: match.id }, data })
          return "updated"
        } catch (error) {
          console.error(`[univis] Failed to update event ${externalId}: ${errorMessage(error)}`)
          return "skipped"
        }
      }

      try {
        await createWithUniqueSlug(data.title, (slug) =>
          prisma.event.create({ data: { ...data, slug } })
        )
        return "created"
      } catch (error) {
        console.error(`[univis] Failed to create event ${externalId}: ${errorMessage(error)}`)
        return "skipped"
      }
    })
  )

  const created = results.filter((r) => r === "created").length
  const updated = results.filter((r) => r === "updated").length
  const skipped = results.filter((r) => r === "skipped").length

  const stale = [...existingMap.entries()].filter(
    ([extId, event]) => !seenIds.has(extId) && !event.hidden
  )
  if (stale.length > 0) {
    await prisma.event.deleteMany({ where: { id: { in: stale.map(([, event]) => event.id) } } })
  }
  const deleted = stale.length

  console.warn(
    `[univis] Done - created: ${created}, updated: ${updated}, deleted: ${deleted}, skipped: ${skipped}`
  )
}
