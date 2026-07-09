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
