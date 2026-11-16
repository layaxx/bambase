type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | RadioNodeList

/**
 * Disables the submit button after the user submits a form. A slow request or a double click
 * can thus not send the form two times.
 */
/**
 * Disables each submit button of the form once it is sent, so that a double click sends nothing
 * twice. `form.elements` also holds the buttons outside of the form that point at it via `form=`.
 * The clicked button shows the spinner.
 */
export function disableSubmitOnSubmit(form: HTMLFormElement): void {
  form.addEventListener("submit", (event) => {
    const buttons = [...form.elements].filter(
      (el): el is HTMLButtonElement => el instanceof HTMLButtonElement && el.type === "submit"
    )
    for (const button of buttons) button.disabled = true
    const submitter = event.submitter instanceof HTMLButtonElement ? event.submitter : buttons[0]
    submitter?.classList.add("loading")
  })
}

export function initDraftPersistence(form: HTMLFormElement, fields: string[]): void {
  disableSubmitOnSubmit(form)

  const draftKey = form.dataset.draftKey
  if (!draftKey) return

  const saved = sessionStorage.getItem(draftKey)
  if (saved) {
    try {
      const draft = JSON.parse(saved) as Record<string, string>
      for (const name of fields) {
        const el = form.elements.namedItem(name) as FormField | null
        if (el && draft[name]) (el as HTMLInputElement).value = draft[name]
      }
    } catch {
      sessionStorage.removeItem(draftKey)
    }
  }

  let submitting = false

  form.addEventListener("submit", () => {
    submitting = true
    const draft: Record<string, string> = {}
    for (const name of fields) {
      const el = form.elements.namedItem(name) as FormField | null
      if (el) draft[name] = (el as HTMLInputElement).value
    }
    sessionStorage.setItem(draftKey, JSON.stringify(draft))
  })

  window.addEventListener("pagehide", () => {
    if (!submitting) sessionStorage.removeItem(draftKey)
  })
}
