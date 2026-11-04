// What the assistant's "To chase" list shows. Pure, so the date rules can be
// tested without a database; chase.ts loads the rows.

export const QUOTE_WARN_DAYS = 7      // list a quote this long before it expires,
export const QUOTE_EXPIRED_DAYS = 14  // and this long after, then stop
export const RFQ_WAIT_DAYS = 3        // give a supplier this long to reply,
export const RFQ_GIVE_UP_DAYS = 30    // and stop chasing after this long

export interface QuoteRow {
  id: string
  supplier: string | null
  reference: string | null
  validUntil: string | null
  project: string | null
}

export interface RfqRow {
  id: string
  supplier: string
  board: string | null
  sentOn: string       // YYYY-MM-DD, South African date
  openedAt: string | null
  linkExpiresOn: string // YYYY-MM-DD
  submitted: boolean
  repliedByEmail: boolean
}

export interface ChaseQuote extends QuoteRow { validUntil: string; daysLeft: number }
export interface ChaseRfq extends RfqRow { daysWaiting: number; opened: boolean; linkExpired: boolean }
export interface ChaseList { quotes: ChaseQuote[]; rfqs: ChaseRfq[] }

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000
const daysFrom = (from: string, to: string) => dayNumber(to) - dayNumber(from)

export function dayOffset(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * 86_400_000).toISOString().slice(0, 10)
}

export function buildChaseList(quotes: QuoteRow[], rfqs: RfqRow[], today: string): ChaseList {
  return {
    quotes: quotes
      .flatMap(q => {
        // Read off a document, so it may not be a date at all.
        if (!q.validUntil || !/^\d{4}-\d{2}-\d{2}$/.test(q.validUntil) || Number.isNaN(dayNumber(q.validUntil))) return []
        const daysLeft = daysFrom(today, q.validUntil)
        return daysLeft > QUOTE_WARN_DAYS || daysLeft < -QUOTE_EXPIRED_DAYS ? [] : [{ ...q, validUntil: q.validUntil, daysLeft }]
      })
      .sort((a, b) => a.daysLeft - b.daysLeft),
    rfqs: rfqs
      .flatMap(r => {
        const daysWaiting = daysFrom(r.sentOn, today)
        // A supplier who answered by email has replied, whatever the link says.
        if (r.submitted || r.repliedByEmail || daysWaiting < RFQ_WAIT_DAYS || daysWaiting > RFQ_GIVE_UP_DAYS) return []
        return [{ ...r, daysWaiting, opened: !!r.openedAt, linkExpired: r.linkExpiresOn < today }]
      })
      .sort((a, b) => b.daysWaiting - a.daysWaiting),
  }
}

export function chaseSummary({ quotes, rfqs }: ChaseList): string {
  const parts: string[] = []
  if (quotes.length) parts.push(`${quotes.length} quote${quotes.length === 1 ? '' : 's'} expiring or expired`)
  if (rfqs.length) parts.push(`${rfqs.length} supplier${rfqs.length === 1 ? '' : 's'} yet to reply`)
  return parts.join(', ')
}
