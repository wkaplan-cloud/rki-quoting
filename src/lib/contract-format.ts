import type { ElecServiceContract } from '@/lib/elec-types'

/**
 * Client-safe helpers for service contracts, shared by the contracts screen,
 * job cards, the handover pack and the invoice run.
 */

export function fmtRand(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Adds whole months to a YYYY-MM-DD date, holding month-end (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function periodMonths(period: ElecServiceContract['billing_period']) {
  return period === 'annual' ? 12 : 1
}

/** The contract year that ends on renewal_date. */
export function contractYear(c: Pick<ElecServiceContract, 'renewal_date'>): { start: string; end: string } {
  return { start: addMonths(c.renewal_date, -12), end: c.renewal_date }
}

const JOB_TYPE_LABEL: Record<string, string> = {
  maintenance: 'maintenance', callout: 'callouts', repair: 'repairs', once_off: 'once-off jobs', emergency: 'emergencies',
}

/** One line describing a plan, as the client would read it. */
export function planSummary(c: Pick<ElecServiceContract, 'fee' | 'billing_period' | 'included_visits' | 'includes_remote_support' | 'callout_rate' | 'covered_job_types' | 'response_time'>): string {
  const parts = [
    `${fmtRand(c.fee)} ${c.billing_period === 'annual' ? 'a year' : 'a month'} (ex VAT)`,
    c.included_visits == null ? 'unlimited visits' : `${c.included_visits} visit${c.included_visits === 1 ? '' : 's'} a year`,
    c.covered_job_types.length ? `covers ${c.covered_job_types.map(t => JOB_TYPE_LABEL[t] ?? t).join(', ')}` : null,
    c.includes_remote_support ? 'remote support included' : null,
    c.response_time ? `${c.response_time} response` : null,
    c.callout_rate != null ? `other work at ${fmtRand(c.callout_rate)}/hour` : null,
  ]
  return parts.filter(Boolean).join(' · ')
}
