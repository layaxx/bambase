import type { Modules } from "@strapi/types"
import { UnivISClient } from "univis-api"
import { format } from "date-fns"
import he from "he"
import removeMd from "remove-markdown"

function parse(str: string): string {
  const decoded = he.decode(str)

  const linkReplaced = decoded.replace(/\[(https?:\/\/\S+)\]\s+\1(?=\s|$)/g, "$1")

  const noMarkdown = removeMd(linkReplaced)

  return noMarkdown
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

type EventInput = Modules.Documents.Params.Data.Input<"api::event.event">

const client = new UnivISClient({ domain: "univis.uni-bamberg.de" })

function parseTime(time: string): [number, number, number] {
  const split = time.split(":")
  const result = [0, 0, 0] as [number, number, number]
  if (split.length >= 1) {
    result[0] = parseInt(split[0], 10) || 0
  }
  if (split.length >= 2) {
    result[1] = parseInt(split[1], 10) || 0
  }
  if (split.length >= 3) {
    result[2] = parseInt(split[2], 10) || 0
  }
  return result
}

function toDatetime(date: string, time: string): string {
  const dateTimeString = new Date(date)
  const parsedTime = parseTime(time)
  dateTimeString.setHours(...parsedTime)

  return format(dateTimeString, "yyyy-MM-dd HH:mm:ss.SSS")
}

async function load() {
  const now = new Date()
  const windowEnd = new Date(now)
  windowEnd.setMonth(windowEnd.getMonth() + 2)

  const start = now.toISOString().split("T")[0]
  const end = windowEnd.toISOString().split("T")[0]

  strapi.log.info(`[univis] Syncing events ${start} → ${end}`)

  let univisEvents: Awaited<ReturnType<typeof client.getCalendar>>

  try {
    univisEvents = await client.getCalendar({ start, end })
  } catch (error) {
    strapi.log.error(
      `[univis] Failed to fetch from UniVis: ${error instanceof Error ? error.message : String(error)}`
    )
    return
  }

  strapi.log.info(`[univis] Received ${univisEvents.length} events`)

  const existing = await strapi.documents("api::event.event").findMany({
    filters: {
      external_id: { $startsWith: "univis:" },
      end: { $gte: now.toISOString() },
    },
    fields: ["documentId", "external_id", "start", "hidden"],
    pagination: { limit: 5000 },
  })

  const existingMap = new Map(existing.map((e) => [e.external_id as string, e]))

  let created = 0
  let updated = 0
  let skipped = 0
  let deleted = 0

  const seenIds = new Set<string>()

  for (const event of univisEvents) {
    const externalId = `univis:${event._key}`

    if (!event.title || !event.startdate || !event.enddate || !event.starttime || !event.endtime) {
      strapi.log.warn(`[univis] Skipping event ${event._key} — missing required fields`)
      skipped++
      continue
    }

    seenIds.add(externalId)

    const organizer = parse(event.orgname)

    const data: EventInput = {
      title: parse(event.title) || `Veranstaltung von ${organizer}`,
      description: parse(event.description ?? "") || `Veranstaltung von ${organizer}`,
      category: "university",
      start: toDatetime(event.startdate, event.starttime),
      end: toDatetime(event.enddate, event.endtime),
      organizer,
      external_id: externalId,
      ...(event.url ? { external_url: event.url } : {}),
    }

    const match = existingMap.get(externalId)

    if (match) {
      if (match.hidden) {
        skipped++
        continue
      }
      try {
        await strapi.documents("api::event.event").update({ documentId: match.documentId, data })
        updated++
      } catch (error) {
        strapi.log.error(
          `[univis] Failed to update event ${externalId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    } else {
      try {
        await strapi.documents("api::event.event").create({ data })
        created++
      } catch (error) {
        strapi.log.error(
          `[univis] Failed to create event ${externalId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
  }

  for (const [extId, event] of existingMap) {
    if (seenIds.has(extId)) continue
    if (event.hidden) continue
    await strapi.documents("api::event.event").delete({ documentId: event.documentId })
    deleted++
  }

  strapi.log.info(
    `[univis] Done — created: ${created}, updated: ${updated}, deleted: ${deleted}, skipped: ${skipped}`
  )
}

export default () => ({
  load,
})
