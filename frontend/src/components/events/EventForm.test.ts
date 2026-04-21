import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import EventForm from "./EventForm.astro"
import type { MapLocation } from "@/utils/api"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

const locals = { locale: "de" as const }

const sampleLocations: MapLocation[] = [
  {
    documentId: "loc-1",
    slug: "uni-bamberg",
    name: "Uni Bamberg",
    lat: 49.9,
    lon: 10.9,
    category: "university",
    address: { city: "Bamberg" },
  },
  {
    documentId: "loc-2",
    slug: "schlenkerla",
    name: "Schlenkerla",
    lat: 49.89,
    lon: 10.89,
    category: "venues",
    address: { city: "Bamberg" },
  },
]

const baseProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: "/_actions/events.create" as any,
  submitLabel: "Erstellen",
  cancelHref: "/events",
  allLocations: sampleLocations,
  inputErrors: {},
}

describe("EventForm", () => {
  describe("required fields", () => {
    it("renders a title input", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('id="title"')
      expect(html).toContain('name="title"')
    })

    it("marks title as required", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toMatch(/id="title"[^>]*required|required[^>]*id="title"/)
    })

    it("renders an organizer input", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('id="organizer"')
      expect(html).toContain('name="organizer"')
    })

    it("renders a start datetime-local input", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('id="start"')
      expect(html).toContain('type="datetime-local"')
    })

    it("renders an end datetime-local input", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('id="end"')
    })

    it("renders a category select with all category options", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('id="category"')
      expect(html).toContain('name="category"')
      // de locale: check for a few known category values
      expect(html).toContain('value="sport"')
      expect(html).toContain('value="university"')
      expect(html).toContain('value="other"')
    })

    it("renders a description textarea", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('id="description"')
      expect(html).toContain('name="description"')
      expect(html).toContain("<textarea")
    })

    it("renders an optional external URL input", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('id="external_url"')
      expect(html).toContain('type="url"')
    })
  })

  describe("form controls", () => {
    it("renders a submit button with the given label", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('type="submit"')
      expect(html).toContain("Erstellen")
    })

    it("renders a cancel link with the given href", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, cancelHref: "/account/events" },
        locals,
      })
      expect(html).toContain('href="/account/events"')
    })
  })

  describe("location type radio buttons", () => {
    it("renders all three location type options (none, linked, custom)", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('value="none"')
      expect(html).toContain('value="linked"')
      expect(html).toContain('value="custom"')
    })

    it("defaults to 'none' radio checked when no initialValues given", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toMatch(/checked[^>]*value="none"|value="none"[^>]*checked/)
    })

    it("linked section has 'hidden' class when locationType is 'none'", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('class="mt-3 hidden" id="linked-location-section"')
    })

    it("custom section has 'hidden' class when locationType is 'none'", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain('id="custom-location-section"')
      expect(html).toContain("hidden")
      expect(html).toContain('class="mt-3 flex flex-col gap-3 hidden" id="custom-location-section"')
    })

    it("linked section does not have 'hidden' class when locationType is 'linked'", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { locationType: "linked" } },
        locals,
      })
      expect(html).toContain('id="linked-location-section"')
      expect(html).not.toContain('class="mt-3 hidden" id="linked-location-section"')
    })

    it("'linked' radio is checked when locationType is 'linked'", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { locationType: "linked" } },
        locals,
      })
      expect(html).toMatch(/checked[^>]*value="linked"|value="linked"[^>]*checked/)
    })

    it("custom section has 'hidden' class when locationType is 'linked'", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { locationType: "linked" } },
        locals,
      })
      expect(html).toContain('class="mt-3 flex flex-col gap-3 hidden" id="custom-location-section"')
    })

    it("custom section does not have 'hidden' class when locationType is 'custom'", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { locationType: "custom" } },
        locals,
      })
      expect(html).toContain('id="custom-location-section"')
      expect(html).not.toContain(
        'class="mt-3 flex flex-col gap-3 hidden" id="custom-location-section"'
      )
    })

    it("'custom' radio is checked when locationType is 'custom'", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { locationType: "custom" } },
        locals,
      })
      expect(html).toMatch(/checked[^>]*value="custom"|value="custom"[^>]*checked/)
    })

    it("linked section has 'hidden' class when locationType is 'custom'", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { locationType: "custom" } },
        locals,
      })
      expect(html).toContain('class="mt-3 hidden" id="linked-location-section"')
    })

    it("renders all available map locations in the linked select", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).toContain("Uni Bamberg")
      expect(html).toContain("Schlenkerla")
    })

    it("appends city to the option label when address.city is present", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      // The template renders name and city as separate expressions, resulting in whitespace between them
      expect(html).toMatch(/Uni Bamberg\s+·\s+Bamberg/)
    })

    it("pre-selects the matching map_location_documentId option", async () => {
      const html = await container.renderToString(EventForm, {
        props: {
          ...baseProps,
          initialValues: { locationType: "linked", map_location_documentId: "loc-2" },
        },
        locals,
      })
      expect(html).toMatch(/value="loc-2"[^>]*selected|selected[^>]*value="loc-2"/)
    })
  })

  describe("initial values", () => {
    it("pre-fills title from initialValues", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { title: "My Test Event" } },
        locals,
      })
      expect(html).toContain('value="My Test Event"')
    })

    it("pre-fills organizer from initialValues", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { organizer: "Test Org" } },
        locals,
      })
      expect(html).toContain('value="Test Org"')
    })

    it("pre-fills description from initialValues", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { description: "Some description text" } },
        locals,
      })
      expect(html).toContain("Some description text")
    })

    it("pre-selects category from initialValues", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { category: "sport" } },
        locals,
      })
      expect(html).toMatch(/value="sport"[^>]*selected|selected[^>]*value="sport"/)
    })

    it("pre-fills start datetime from initialValues", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { start: "2099-12-01T18:00" } },
        locals,
      })
      expect(html).toContain('value="2099-12-01T18:00"')
    })

    it("pre-fills end datetime from initialValues", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, initialValues: { end: "2099-12-01T20:00" } },
        locals,
      })
      expect(html).toContain('value="2099-12-01T20:00"')
    })

    it("pre-fills custom location name from initialValues", async () => {
      const html = await container.renderToString(EventForm, {
        props: {
          ...baseProps,
          initialValues: { locationType: "custom", custom_location_name: "Test Venue" },
        },
        locals,
      })
      expect(html).toContain('value="Test Venue"')
    })

    it("pre-fills custom location address from initialValues", async () => {
      const html = await container.renderToString(EventForm, {
        props: {
          ...baseProps,
          initialValues: {
            locationType: "custom",
            custom_location_address: "Teststraße 1",
          },
        },
        locals,
      })
      expect(html).toContain('value="Teststraße 1"')
    })
  })

  describe("error display", () => {
    it("shows error message for title when inputErrors.title is set", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, inputErrors: { title: ["Titel ist erforderlich"] } },
        locals,
      })
      expect(html).toContain("Titel ist erforderlich")
    })

    it("adds input-error class to title input when there is a title error", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, inputErrors: { title: ["Fehler"] } },
        locals,
      })
      expect(html).toMatch(/id="title"[^>]*input-error|input-error[^"]*"[^>]*id="title"/)
    })

    it("shows error message for start when inputErrors.start is set", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, inputErrors: { start: ["Ungültiges Datum"] } },
        locals,
      })
      expect(html).toContain("Ungültiges Datum")
    })

    it("shows error message for description when inputErrors.description is set", async () => {
      const html = await container.renderToString(EventForm, {
        props: {
          ...baseProps,
          inputErrors: { description: ["Beschreibung ist erforderlich"] },
        },
        locals,
      })
      expect(html).toContain("Beschreibung ist erforderlich")
    })

    it("shows no inline error text when inputErrors is empty", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).not.toContain("text-error")
    })
  })

  describe("documentId hidden input", () => {
    it("renders a hidden documentId input when documentId prop is provided", async () => {
      const html = await container.renderToString(EventForm, {
        props: { ...baseProps, documentId: "doc-abc123" },
        locals,
      })
      expect(html).toContain('name="documentId"')
      expect(html).toContain('value="doc-abc123"')
      expect(html).toContain('type="hidden"')
    })

    it("does not render a documentId input when documentId is not provided", async () => {
      const html = await container.renderToString(EventForm, { props: baseProps, locals })
      expect(html).not.toContain('name="documentId"')
    })
  })
})
