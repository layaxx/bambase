import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import JobForm from "./JobForm.astro"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

const locals = { locale: "de" as const }

const baseProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: "/_actions/jobs.create" as any,
  submitLabel: "Erstellen",
  cancelHref: "/jobs",
  inputErrors: {},
}

describe("JobForm", () => {
  describe("required fields", () => {
    it("renders a title input", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="title"')
      expect(html).toContain('name="title"')
    })

    it("marks title as required", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toMatch(/id="title"[^>]*required|required[^>]*id="title"/)
    })

    it("renders a company input", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="company"')
      expect(html).toContain('name="company"')
    })

    it("renders a location input", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="location"')
      expect(html).toContain('name="location"')
    })

    it("renders a working_hours number input with min/max constraints", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="working_hours"')
      expect(html).toContain('type="number"')
      expect(html).toContain('min="0"')
      expect(html).toContain('max="168"')
    })

    it("renders a job_type select with all type options", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="job_type"')
      expect(html).toContain('name="job_type"')
      expect(html).toContain('value="part_time"')
      expect(html).toContain('value="internship"')
      expect(html).toContain('value="working_student"')
    })

    it("renders a field select", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="field"')
      expect(html).toContain('name="field"')
      expect(html).toContain('value="it"')
      expect(html).toContain('value="marketing"')
    })

    it("renders a description textarea", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="description"')
      expect(html).toContain('name="description"')
      expect(html).toContain("<textarea")
    })

    it("renders an optional external URL input", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="external_url"')
      expect(html).toContain('type="url"')
    })
  })

  describe("contact section", () => {
    it("renders a contact section heading", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      // de locale: t.jobs.contactSection = "Kontaktdaten"
      expect(html).toContain("Kontaktdaten")
    })

    it("renders a contact name input", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="contact_name"')
      expect(html).toContain('name="contact_name"')
    })

    it("renders a contact email input", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="contact_mail"')
      expect(html).toContain('type="email"')
    })

    it("renders a contact phone input", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('id="contact_phone"')
      expect(html).toContain('type="tel"')
    })
  })

  describe("form controls", () => {
    it("renders a submit button with the given label", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).toContain('type="submit"')
      expect(html).toContain("Erstellen")
    })

    it("renders a cancel link with the given href", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, cancelHref: "/account/jobs" },
        locals,
      })
      expect(html).toContain('href="/account/jobs"')
    })
  })

  describe("initial values", () => {
    it("pre-fills title from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { title: "Software Engineer" } },
        locals,
      })
      expect(html).toContain('value="Software Engineer"')
    })

    it("pre-fills company from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { company: "Acme GmbH" } },
        locals,
      })
      expect(html).toContain('value="Acme GmbH"')
    })

    it("pre-fills location from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { location: "Bamberg" } },
        locals,
      })
      expect(html).toContain('value="Bamberg"')
    })

    it("pre-fills working_hours from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { working_hours: 20 } },
        locals,
      })
      expect(html).toContain('value="20"')
    })

    it("pre-fills description from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { description: "Exciting opportunity" } },
        locals,
      })
      expect(html).toContain("Exciting opportunity")
    })

    it("pre-selects job_type from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { job_type: "internship" } },
        locals,
      })
      expect(html).toMatch(/value="internship"[^>]*selected|selected[^>]*value="internship"/)
    })

    it("pre-selects field from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { field: "it" } },
        locals,
      })
      expect(html).toMatch(/value="it"[^>]*selected|selected[^>]*value="it"/)
    })

    it("pre-fills contact_name from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { contact_name: "Max Mustermann" } },
        locals,
      })
      expect(html).toContain('value="Max Mustermann"')
    })

    it("pre-fills contact_mail from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { contact_mail: "max@example.com" } },
        locals,
      })
      expect(html).toContain('value="max@example.com"')
    })

    it("pre-fills contact_phone from initialValues", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, initialValues: { contact_phone: "+49123456789" } },
        locals,
      })
      expect(html).toContain('value="+49123456789"')
    })
  })

  describe("error display", () => {
    it("shows error message for title when inputErrors.title is set", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, inputErrors: { title: ["Titel ist erforderlich"] } },
        locals,
      })
      expect(html).toContain("Titel ist erforderlich")
    })

    it("adds input-error class to title input on error", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, inputErrors: { title: ["Fehler"] } },
        locals,
      })
      expect(html).toMatch(/id="title"[^>]*input-error|input-error[^"]*"[^>]*id="title"/)
    })

    it("shows error message for company when inputErrors.company is set", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, inputErrors: { company: ["Pflichtfeld"] } },
        locals,
      })
      expect(html).toContain("Pflichtfeld")
    })

    it("shows error message for working_hours when inputErrors.working_hours is set", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, inputErrors: { working_hours: ["Ungültige Stundenzahl"] } },
        locals,
      })
      expect(html).toContain("Ungültige Stundenzahl")
    })

    it("shows no inline error text when inputErrors is empty", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).not.toContain("text-error")
    })
  })

  describe("documentId hidden input", () => {
    it("renders a hidden documentId input when documentId prop is provided", async () => {
      const html = await container.renderToString(JobForm, {
        props: { ...baseProps, documentId: "job-doc-xyz" },
        locals,
      })
      expect(html).toContain('name="documentId"')
      expect(html).toContain('value="job-doc-xyz"')
      expect(html).toContain('type="hidden"')
    })

    it("does not render a documentId input when documentId is not provided", async () => {
      const html = await container.renderToString(JobForm, { props: baseProps, locals })
      expect(html).not.toContain('name="documentId"')
    })
  })
})
