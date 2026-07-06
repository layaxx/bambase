type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | RadioNodeList

export function initDraftPersistence(form: HTMLFormElement, fields: string[]): void {
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
  const submitBtn = form.querySelector<HTMLButtonElement>('[type="submit"]')

  form.addEventListener("submit", () => {
    submitting = true
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.classList.add("loading")
    }
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
