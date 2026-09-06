import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import LocationForm from "./LocationForm.astro"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

const locals = {
  locale: "de" as const,
  user: null,
  session: null,
}

const baseProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: "/_actions/locations.create" as any,
  submitLabel: "Erstellen",
  cancelHref: "/admin/locations",
  inputErrors: {},
}

describe("LocationForm", () => {
  it("renders a name input", async () => {
    const html = await container.renderToString(LocationForm, { props: baseProps, locals })
    expect(html).toContain('id="name"')
    expect(html).toContain('name="name"')
  })

  it("renders a category select with all category options", async () => {
    const html = await container.renderToString(LocationForm, { props: baseProps, locals })
    expect(html).toContain('id="category"')
    expect(html).toContain('value="university"')
    expect(html).toContain('value="mensa"')
    expect(html).toContain('value="other"')
  })

  it("renders required lat and lon number inputs", async () => {
    const html = await container.renderToString(LocationForm, { props: baseProps, locals })
    expect(html).toContain('id="lat"')
    expect(html).toContain('id="lon"')
    expect(html).toMatch(/id="lat"[^>]*required|required[^>]*id="lat"/)
    expect(html).toMatch(/id="lon"[^>]*required|required[^>]*id="lon"/)
  })

  it("renders an optional external URL input", async () => {
    const html = await container.renderToString(LocationForm, { props: baseProps, locals })
    expect(html).toContain('id="external_url"')
    expect(html).toContain('type="url"')
  })

  it("renders address fields", async () => {
    const html = await container.renderToString(LocationForm, { props: baseProps, locals })
    expect(html).toContain('id="address_street"')
    expect(html).toContain('id="address_street_number"')
    expect(html).toContain('id="address_city"')
    expect(html).toContain('id="address_zip"')
  })

  it("pre-fills values from initialValues", async () => {
    const html = await container.renderToString(LocationForm, {
      props: {
        ...baseProps,
        initialValues: { name: "Audimax", lat: 49.8988, lon: 10.9028 },
      },
      locals,
    })
    expect(html).toContain('value="Audimax"')
    expect(html).toContain('value="49.8988"')
    expect(html).toContain('value="10.9028"')
  })

  it("renders a hidden id input when id prop is provided", async () => {
    const html = await container.renderToString(LocationForm, {
      props: { ...baseProps, id: "loc-abc123" },
      locals,
    })
    expect(html).toContain('name="id"')
    expect(html).toContain('value="loc-abc123"')
    expect(html).toContain('type="hidden"')
  })

  it("does not render a hidden id input when id is not provided", async () => {
    const html = await container.renderToString(LocationForm, { props: baseProps, locals })
    expect(html).not.toMatch(/name="id"/)
  })

  it("shows error message for name when inputErrors.name is set", async () => {
    const html = await container.renderToString(LocationForm, {
      props: { ...baseProps, inputErrors: { name: ["Name ist erforderlich"] } },
      locals,
    })
    expect(html).toContain("Name ist erforderlich")
  })
})
