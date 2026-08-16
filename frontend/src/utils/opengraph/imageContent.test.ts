import { describe, expect, it } from "vitest"
import { makeEventSubtitleItems, makeImageContent, makeJobOfferSubtitleItems } from "./imageContent"
import { EventCategory, JobType } from "@/generated/prisma/enums"

interface Node {
  type: string
  props: { style?: Record<string, unknown>; children?: unknown }
}

function asNode(value: unknown): Node {
  return value as Node
}

describe("makeImageContent", () => {
  it("keeps a short title unchanged and uses the large title font size", () => {
    const content = asNode(
      makeImageContent({ titleContent: "Kurzer Titel", subtitleItems: [], category: "Jobs" })
    )

    const [categorySpan, body] = content.props.children as Node[]
    const [titleDiv] = body.props.children as Node[]

    expect(categorySpan.props.children).toBe("BamBase - Jobs")
    expect(titleDiv.props.children).toBe("Kurzer Titel")
    expect(titleDiv.props.style?.fontSize).toBe(60)
  })

  it("switches to the smaller title font size once the title exceeds 45 characters", () => {
    const title = "Ein Titel mit genau fünfzig Zeichen für den Test XX"
    expect(title.length).toBeGreaterThan(45)
    expect(title.length).toBeLessThanOrEqual(60)

    const content = asNode(
      makeImageContent({ titleContent: title, subtitleItems: [], category: "Jobs" })
    )
    const [, body] = content.props.children as Node[]
    const [titleDiv] = body.props.children as Node[]

    expect(titleDiv.props.children).toBe(title)
    expect(titleDiv.props.style?.fontSize).toBe(50)
  })

  it("truncates titles longer than 60 characters and appends an ellipsis", () => {
    const longTitle = "X".repeat(80)
    const content = asNode(
      makeImageContent({ titleContent: longTitle, subtitleItems: [], category: "Jobs" })
    )
    const [, body] = content.props.children as Node[]
    const [titleDiv] = body.props.children as Node[]

    expect(titleDiv.props.children).toBe(`${"X".repeat(57)}…`)
    expect((titleDiv.props.children as string).length).toBe(58)
    expect(titleDiv.props.style?.fontSize).toBe(50)
  })

  it("passes subtitleItems through to the subtitle row unchanged", () => {
    const subtitleItems = [{ type: "span", props: { children: "ACME" } }]
    const content = asNode(
      makeImageContent({ titleContent: "Titel", subtitleItems, category: "Jobs" })
    )
    const [, body] = content.props.children as Node[]
    const [, subtitleRow] = body.props.children as Node[]

    expect(subtitleRow.props.children).toBe(subtitleItems)
  })

  it("renders the static footer with the site name and domain", () => {
    const content = asNode(
      makeImageContent({ titleContent: "Titel", subtitleItems: [], category: "Jobs" })
    )
    const [, , footer] = content.props.children as Node[]
    const [siteName, domain] = footer.props.children as Node[]

    expect(siteName.props.children).toBe("BamBase - Das Studierendenportal für Bamberg")
    expect(domain.props.children).toBe("bambase.de")
  })
})

describe("makeJobOfferSubtitleItems", () => {
  it("returns only the company label when no job type is set", () => {
    const items = makeJobOfferSubtitleItems({
      company: "ACME",
      job_type: null as unknown as JobType,
    }).map(asNode)

    expect(items).toHaveLength(1)
    expect(items[0].props.children).toBe("ACME")
  })

  it("appends a translated job type badge when a job type is set", () => {
    const items = makeJobOfferSubtitleItems({
      company: "ACME",
      job_type: JobType.working_student,
    }).map(asNode)

    expect(items).toHaveLength(2)
    expect(items[0].props.children).toBe("ACME")
    expect(items[1].props.children).toBe("Werkstudent")
    expect(items[1].props.style?.color).toBe("#86efac")
  })
})

describe("makeEventSubtitleItems", () => {
  it("returns only the formatted date when no category is set", () => {
    const items = makeEventSubtitleItems({
      start: "2026-08-20T10:00:00.000Z",
      category: null as unknown as EventCategory,
    }).map(asNode)

    expect(items).toHaveLength(1)
    expect(items[0].props.children).toBe(
      new Date("2026-08-20T10:00:00.000Z").toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    )
  })

  it("appends a translated category badge when a category is set", () => {
    const items = makeEventSubtitleItems({
      start: "2026-08-20T10:00:00.000Z",
      category: EventCategory.university,
    }).map(asNode)

    expect(items).toHaveLength(2)
    expect(items[1].props.children).toBe("Hochschule")
    expect(items[1].props.style?.color).toBe("#7dd3fc")
  })
})
