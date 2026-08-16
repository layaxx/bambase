type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | RadioNodeList

/** Disables the submit button once a form is submitted, so a slow request or double-click can't fire it twice. */
export function disableSubmitOnSubmit(form: HTMLFormElement): void {
  const submitBtn = form.querySelector<HTMLButtonElement>('[type="submit"]')
  form.addEventListener("submit", () => {
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.classList.add("loading")
    }
  })
}

export function initDraftPersistence(form: HTMLFormElement, fields: string[]): void {
  disableSubmitOnSubmit(form)

  const draftKey = form.dataset.draftKey
  if (!draftKey) return

  const saved = sessionStorage.getItem(draftKey)
  if (saved) {
    const draft = JSON.parse(saved) as Record<string, string>
    for (const name of fields) {
      const el = form.elements.namedItem(name) as FormField | null
      if (el && draft[name]) (el as HTMLInputElement).value = draft[name]
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
