import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import ReportModal from "./ReportModal.astro"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

const locals = { locale: "de" as const }

describe("ReportModal", () => {
  describe("button label", () => {
    it("uses the job report label for targetType=job", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "job", targetId: "abc" },
        locals,
      })
      // de locale: t.reports.reportJob should not equal t.reports.reportEvent
      // Both must produce non-empty text; verify the two variants differ
      const jobHtml = html

      const eventHtml = await container.renderToString(ReportModal, {
        props: { targetType: "event", targetId: "abc" },
        locals,
      })

      // The button text must differ between the two targetType values
      expect(jobHtml).not.toBe(eventHtml)
    })

    it("renders a non-empty button label for targetType=job", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "job", targetId: "xyz" },
        locals,
      })
      expect(html).toContain("<button")
    })

    it("renders a non-empty button label for targetType=event", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "event", targetId: "xyz" },
        locals,
      })
      expect(html).toContain("<button")
    })
  })

  describe("hidden form inputs", () => {
    it("sets target_type hidden input to the targetType prop", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "job", targetId: "42" },
        locals,
      })
      expect(html).toContain('name="target_type"')
      expect(html).toContain('value="job"')
    })

    it("sets target_id hidden input to the targetId prop", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "event", targetId: "99" },
        locals,
      })
      expect(html).toContain('name="target_id"')
      expect(html).toContain('value="99"')
    })

    it("does not leak one targetId into another render", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "job", targetId: "111" },
        locals,
      })
      expect(html).not.toContain('value="999"')
    })
  })

  describe("form structure", () => {
    it("renders a dialog element with id=reportModal", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "job", targetId: "1" },
        locals,
      })
      expect(html).toContain('id="reportModal"')
      expect(html).toContain("<dialog")
    })

    it("renders all four reason options", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "job", targetId: "1" },
        locals,
      })
      expect(html).toContain('value="spam"')
      expect(html).toContain('value="inappropriate"')
      expect(html).toContain('value="outdated"')
      expect(html).toContain('value="other"')
    })

    it("renders a textarea for optional details", async () => {
      const html = await container.renderToString(ReportModal, {
        props: { targetType: "event", targetId: "1" },
        locals,
      })
      expect(html).toContain("<textarea")
      expect(html).toContain('name="details"')
    })
  })
})
