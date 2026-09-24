import { addMonths } from '@/lib/contract-format'

/**
 * Validates a contract create/edit body into columns. Only keys present are
 * returned, so an edit leaves the rest alone.
 */
const JOB_TYPES = ['maintenance', 'callout', 'repair', 'once_off', 'emergency']
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const num = (v: unknown) => (v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : NaN)

export function contractFields(body: Record<string, unknown>, creating: boolean): { error: string } | { fields: Record<string, unknown> } {
  const f: Record<string, unknown> = {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  if (creating || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return { error: 'Give the plan a name' }
    f.name = name.slice(0, 120)
  }
  if (creating || has('billing_period')) {
    if (body.billing_period !== 'monthly' && body.billing_period !== 'annual') return { error: 'Billing must be monthly or annual' }
    f.billing_period = body.billing_period
  }
  if (creating || has('fee')) {
    const fee = num(body.fee)
    if (fee == null || Number.isNaN(fee) || fee < 0) return { error: 'Enter the plan fee' }
    f.fee = fee
  }
  if (has('included_visits')) {
    const v = num(body.included_visits)
    if (Number.isNaN(v) || (v != null && (v < 0 || !Number.isInteger(v)))) return { error: 'Visits must be a whole number, or blank for unlimited' }
    f.included_visits = v
  }
  if (has('callout_rate')) {
    const v = num(body.callout_rate)
    if (Number.isNaN(v) || (v != null && v < 0)) return { error: 'Callout rate must be a number' }
    f.callout_rate = v
  }
  if (has('includes_remote_support')) f.includes_remote_support = body.includes_remote_support === true
  if (has('auto_renew')) f.auto_renew = body.auto_renew === true
  if (has('covered_job_types')) {
    const list = Array.isArray(body.covered_job_types) ? body.covered_job_types.filter((t): t is string => typeof t === 'string' && JOB_TYPES.includes(t)) : []
    f.covered_job_types = list
  }
  for (const k of ['response_time', 'notes', 'sage_customer_id', 'sage_customer_name'] as const) {
    if (has(k)) f[k] = typeof body[k] === 'string' && (body[k] as string).trim() ? (body[k] as string).trim().slice(0, 2000) : null
  }
  if (creating || has('start_date')) {
    if (!isDate(body.start_date)) return { error: 'Choose a start date' }
    f.start_date = body.start_date
  }
  if (has('renewal_date') || creating) {
    const renewal = isDate(body.renewal_date) ? body.renewal_date : creating ? addMonths(f.start_date as string, 12) : null
    if (!renewal) return { error: 'Choose a renewal date' }
    f.renewal_date = renewal
  }
  if (has('next_invoice_date') || creating) {
    f.next_invoice_date = isDate(body.next_invoice_date) ? body.next_invoice_date : creating ? f.start_date : null
  }
  if (has('status')) {
    if (!['active', 'paused', 'ended'].includes(body.status as string)) return { error: 'Unknown status' }
    f.status = body.status
  }
  return { fields: f }
}
