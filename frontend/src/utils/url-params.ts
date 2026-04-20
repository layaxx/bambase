export function getParam(key: string, fallback: string): string {
  return new URLSearchParams(location.search).get(key) ?? fallback
}

export function setParam(key: string, value: string): void {
  const params = new URLSearchParams(location.search)
  params.set(key, value)
  history.replaceState(null, "", `?${params}`)
}
