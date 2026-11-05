/** The local calendar day of `d` as YYYY-MM-DD. */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(d.getDate() + days)
  return next
}
