// Pure rules behind the Supplier Prices sheet: which copies are the same
// document, and whether an invoice matches the supplier's earlier quote.
// Kept apart from sheet.ts so they can be tested without Supabase or Google.

// Quotes and proformas are both "what we were told it would cost"; a proforma
// is usually followed by an invoice for the same goods, so counting it as
// invoiced would bill the client twice in the totals.
export const QUOTE_TYPES = ['supplier_quote', 'proforma']
export const INVOICE_TYPES = ['invoice']
export const TYPE_LABEL: Record<string, string> = { supplier_quote: 'Quote', proforma: 'Proforma', invoice: 'Invoice' }

/** An invoice line counts as over the quote above half a percent (rounding on PDFs). */
export const OVER_TOLERANCE = 0.005

export const UNASSIGNED = 'Unassigned'

// ── Documents ──

export interface Line {
  description: string
  code: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  line_total: number | null
  // Set on invoice lines that match a line on an earlier quote.
  quoted?: number | null
  quoteRef?: string | null
}

export interface Doc {
  id: string
  side: 'quote' | 'invoice'
  docType: string
  received: string
  docDate: string | null
  projectId: string | null
  client: string
  project: string
  supplier: string
  supplierKey: string
  ref: string | null
  excl: number | null
  vat: number | null
  incl: number | null
  currency: string
  validUntil: string | null
  printedClient: string | null
  link: string | null
  unsure: boolean
  copies: number
  lines: Line[]
  checks: { text: string; level: Level }[]
}

export type Level = 'bad' | 'warn' | 'good'

export const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
export const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
export const isoDay = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null)

/**
 * The same PDF often arrives more than once (a forwarded thread, a resend).
 * Same supplier, type, number and total is one document; a revision with the
 * same number but a new total is kept as its own row.
 */
export function dedupe(docs: Doc[]): Doc[] {
  const kept = new Map<string, Doc>()
  const out: Doc[] = []
  for (const d of docs) {
    if (!d.ref) { out.push(d); continue }
    const key = [d.supplierKey, d.docType, norm(d.ref), d.incl ?? d.excl].join('|')
    const prev = kept.get(key)
    if (!prev) { kept.set(key, d); out.push(d); continue }
    // Keep the copy someone filed to a project; otherwise the first.
    const winner = !prev.projectId && d.projectId ? d : prev
    winner.copies = prev.copies + 1
    if (winner !== prev) out[out.indexOf(prev)] = winner
    kept.set(key, winner)
  }
  return out
}

function sameItem(a: Line, b: Line): boolean {
  if (norm(a.code) && norm(b.code)) return norm(a.code) === norm(b.code)
  return !!norm(a.description) && norm(a.description) === norm(b.description)
}

// Fixed format (R1 234.50) rather than toLocaleString, whose output depends on the server's ICU data.
const money = (n: number) => `R${Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`

/** Compare each invoice with the same supplier's earlier quotes, and flag quotes that have run out. */
export function check(docs: Doc[], today: string): void {
  const quotes = docs.filter(d => d.side === 'quote')
  for (const d of docs) {
    if (d.copies > 1) d.checks.push({ text: `Received ${d.copies} times`, level: 'warn' })
    if (d.unsure) d.checks.push({ text: 'Project not certain — check', level: 'warn' })

    if (d.side === 'quote') {
      if (d.validUntil && d.validUntil < today) d.checks.push({ text: `Expired ${d.validUntil}`, level: 'warn' })
      continue
    }

    // Earlier quotes from this supplier: this project's first, then newest first.
    const candidates = quotes
      .filter(q => q.supplierKey === d.supplierKey && q.received <= d.received && q.currency === d.currency)
      .sort((a, b) => Number(b.projectId === d.projectId && !!d.projectId) - Number(a.projectId === d.projectId && !!d.projectId)
        || b.received.localeCompare(a.received))

    let matched = 0
    let overLines = 0
    let overAmount = 0
    const refs = new Set<string>()
    for (const line of d.lines) {
      for (const q of candidates) {
        const ql = q.lines.find(l => sameItem(l, line))
        if (!ql) continue
        line.quoted = ql.unit_price
        line.quoteRef = q.ref ?? q.received
        matched++
        refs.add(line.quoteRef)
        if (line.unit_price != null && ql.unit_price != null) {
          const diff = line.unit_price - ql.unit_price
          if (diff > Math.max(0.01, ql.unit_price * OVER_TOLERANCE)) {
            overLines++
            overAmount += diff * (line.quantity ?? 1)
          }
        }
        break
      }
    }

    const quoteList = [...refs].join(', ')
    if (overLines) {
      d.checks.push({ text: `Above quote ${quoteList} on ${overLines} line${overLines > 1 ? 's' : ''}: +${money(overAmount)}`, level: 'bad' })
    } else if (matched) {
      d.checks.push({ text: `Matches quote ${quoteList}`, level: 'good' })
    } else {
      const sameTotal = candidates.find(q => q.excl != null && d.excl != null && Math.abs(q.excl - d.excl) < 0.01)
      if (sameTotal) d.checks.push({ text: `Same total as quote ${sameTotal.ref ?? sameTotal.received}`, level: 'good' })
    }
  }
}

