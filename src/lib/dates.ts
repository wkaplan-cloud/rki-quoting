// Date helpers — all "today" stamps in the app must use South African time.
//
// `new Date().toISOString().split('T')[0]` returns the UTC date, which is
// yesterday between 00:00 and 02:00 SAST — that off-by-one leaked into
// quote/invoice dates. Vercel servers run in UTC, so the timezone must be
// pinned here rather than relying on the runtime's locale.
export function todaySA(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())
}

/**
 * Renders a stored timestamptz as the naive "YYYY-MM-DDTHH:mm" that a
 * `<input type="datetime-local">` expects, in South African time.
 *
 * Slicing the raw ISO string instead shows the UTC wall-clock, which reads two
 * hours early — an 08:00 SAST booking would render as 06:00.
 */
export function toSADateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value
    return acc
  }, {})
  // en-CA renders midnight as "24" in some ICU versions
  const hour = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`
}
