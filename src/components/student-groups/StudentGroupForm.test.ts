import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import StudentGroupForm from "./StudentGroupForm.astro"

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
  action: "/_actions/studentGroups.create" as any,
  submitLabel: "Erstellen",
  cancelHref: "/admin/student-groups",
  inputErrors: {},
}

describe("StudentGroupForm", () => {
  it("renders a name input", async () => {
    const html = await container.renderToString(StudentGroupForm, { props: baseProps, locals })
    expect(html).toContain('id="name"')
    expect(html).toContain('name="name"')
  })

  it("renders a required description textarea", async () => {
    const html = await container.renderToString(StudentGroupForm, { props: baseProps, locals })
    expect(html).toContain('id="description"')
    expect(html).toMatch(/id="description"[^>]*required|required[^>]*id="description"/)
  })

  it("renders optional website, instagram, facebook, and email inputs", async () => {
    const html = await container.renderToString(StudentGroupForm, { props: baseProps, locals })
    expect(html).toContain('id="website"')
    expect(html).toContain('id="instagram"')
    expect(html).toContain('id="facebook"')
    expect(html).toContain('id="email"')
    expect(html).toContain('type="email"')
  })

  it("pre-fills values from initialValues", async () => {
    const html = await container.renderToString(StudentGroupForm, {
      props: {
        ...baseProps,
        initialValues: { name: "Fachschaft Informatik", description: "Studentenvertretung" },
      },
      locals,
    })
    expect(html).toContain('value="Fachschaft Informatik"')
    expect(html).toContain("Studentenvertretung")
  })

  it("renders a hidden id input when id prop is provided", async () => {
    const html = await container.renderToString(StudentGroupForm, {
      props: { ...baseProps, id: "grp-abc123" },
      locals,
    })
    expect(html).toContain('name="id"')
    expect(html).toContain('value="grp-abc123"')
    expect(html).toContain('type="hidden"')
  })

  it("does not render a hidden id input when id is not provided", async () => {
    const html = await container.renderToString(StudentGroupForm, { props: baseProps, locals })
    expect(html).not.toMatch(/name="id"/)
  })

  it("shows error message for name when inputErrors.name is set", async () => {
    const html = await container.renderToString(StudentGroupForm, {
      props: { ...baseProps, inputErrors: { name: ["Name ist erforderlich"] } },
      locals,
    })
    expect(html).toContain("Name ist erforderlich")
  })

  it("shows error message for website when inputErrors.website is set", async () => {
    const html = await container.renderToString(StudentGroupForm, {
      props: { ...baseProps, inputErrors: { website: ["Ungültige URL"] } },
      locals,
    })
    expect(html).toContain("Ungültige URL")
  })
})
