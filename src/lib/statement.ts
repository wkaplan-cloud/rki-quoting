import type { SupabaseClient } from '@supabase/supabase-js'
import { computeTotals, type LineItemCalcInput } from './quoting'
import { fetchAllRows } from './fetch-all-rows'
import type { Client, PaymentMethod, ProjectPayment, ProjectStatus } from './types'

/**
 * A client statement: every project the client has accepted, what each one
 * costs, what has been paid against it, and what is still owed.
 *
 * Totals are the invoice's own figure (computeTotals over the line items, the
 * project's VAT rate), so a statement can never disagree with an invoice.
 * Paid comes from project_payments — except on a project linked to a Sage
 * invoice, where Sage owns the paid figure and it is shown as a single line.
 *
 * Nothing is stored: a statement is worked out fresh every time it is opened.
 */

/** Accepted work. Draft and Quote are not owed yet; Cancelled never is. */
const BILLED_STATUSES: ProjectStatus[] = ['Approved', 'Deposit', 'Invoice', 'Paid', 'Completed']

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  eft: 'EFT',
  card: 'Card',
  cash: 'Cash',
  other: 'Other',
}

export interface StatementLine {
  /** Payment row id, or a synthetic key for the Sage / paid-in-full lines. */
  key: string
  paid_on: string | null
  amount: number
  label: string
}

export interface StatementProject {
  id: string
  project_number: string
  project_name: string
  /** Invoice date if one has been issued, otherwise null ("not yet invoiced"). */
  invoiced_date: string | null
  total: number
  payments: StatementLine[]
  paid: number
  /** Negative when the client has paid more than the project total. */
  balance: number
}

export interface Statement {
  client: Client
  projects: StatementProject[]
  total: number
  paid: number
  balance: number
}

const cents = (n: number) => Math.round(n * 100) / 100

/** The studio's platform switch (settings.statements_enabled). RLS scopes it to the caller's org. */
export async function statementsEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from('settings').select('statements_enabled').maybeSingle()
  return data?.statements_enabled === true
}

/** Client-facing: method and reference only. Notes are the studio's own and stay off the statement. */
function paymentLabel(p: Pick<ProjectPayment, 'method' | 'reference'>): string {
  const parts = [p.method ? PAYMENT_METHOD_LABELS[p.method] : null, p.reference].filter(Boolean)
  return parts.length ? `Payment · ${parts.join(' · ')}` : 'Payment'
}

interface StatementProjectRow {
  id: string
  project_number: string
  project_name: string
  status: ProjectStatus
  design_fee: number
  vat_rate: number | null
  invoiced_date: string | null
  quoted_date: string | null
  created_at: string
  archived_at: string | null
  sage_invoice_id: string | null
  deposit_amount_received: number | null
  stages: { final_invoice_paid: boolean } | { final_invoice_paid: boolean }[] | null
}

type LineRow = LineItemCalcInput & { id: string; project_id: string }

/**
 * Builds the statement for one client. Pass the RLS client from the request,
 * so a studio can only ever see its own clients.
 *
 * @param includeSettled Also list projects with nothing left to pay. Archived
 *   projects only ever appear while they still have a balance.
 */
export async function loadStatement(
  supabase: SupabaseClient,
  clientId: string,
  { includeSettled = false }: { includeSettled?: boolean } = {},
): Promise<Statement | null> {
  const [{ data: client }, { data: rawProjects, error: projectsError }, { data: settings }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
    supabase
      .from('projects')
      .select('id, project_number, project_name, status, design_fee, vat_rate, invoiced_date, quoted_date, created_at, archived_at, sage_invoice_id, deposit_amount_received, stages:project_stages(final_invoice_paid)')
      .eq('client_id', clientId)
      .neq('status', 'Cancelled'),
    supabase.from('settings').select('vat_rate').maybeSingle(),
  ])
  if (!client) return null
  if (projectsError) throw new Error(projectsError.message)

  const projects = (rawProjects ?? []) as unknown as StatementProjectRow[]
  const ids = projects.map(p => p.id)

  const [lines, payments] = ids.length
    ? await Promise.all([
        fetchAllRows<LineRow>((from, to) =>
          supabase
            .from('line_items')
            .select('id, project_id, cost_price, markup_percentage, quantity, row_type, sale_price_override')
            .in('project_id', ids)
            .order('id')
            .range(from, to),
        ),
        fetchAllRows<ProjectPayment>((from, to) =>
          supabase
            .from('project_payments')
            .select('id, project_id, amount, paid_on, method, reference, note, created_at')
            .in('project_id', ids)
            .order('paid_on')
            .order('id')
            .range(from, to),
        ),
      ])
    : [{ rows: [], error: null, truncated: false }, { rows: [], error: null, truncated: false }]
  if (lines.error || payments.error) throw new Error(lines.error ?? payments.error ?? 'Failed to load statement')

  const linesByProject = new Map<string, LineRow[]>()
  for (const l of lines.rows) linesByProject.set(l.project_id, [...(linesByProject.get(l.project_id) ?? []), l])
  const paymentsByProject = new Map<string, ProjectPayment[]>()
  for (const p of payments.rows) paymentsByProject.set(p.project_id, [...(paymentsByProject.get(p.project_id) ?? []), p])

  const defaultVat = settings?.vat_rate ?? 15
  const out: StatementProject[] = []

  for (const p of projects) {
    const recorded = paymentsByProject.get(p.id) ?? []
    if (!BILLED_STATUSES.includes(p.status) && recorded.length === 0) continue

    const total = cents(computeTotals(linesByProject.get(p.id) ?? [], p.design_fee, p.vat_rate ?? defaultVat).grand_total)

    const entries: StatementLine[] = p.sage_invoice_id
      ? (p.deposit_amount_received ?? 0) > 0
        ? [{ key: `${p.id}:sage`, paid_on: null, amount: cents(p.deposit_amount_received ?? 0), label: 'Payments received (per Sage)' }]
        : []
      : recorded.map(r => ({ key: r.id, paid_on: r.paid_on, amount: cents(Number(r.amount)), label: paymentLabel(r) }))

    // The studio ticked Paid in Full without recording every payment. Their tick
    // is the truth, so the statement shows the project as settled rather than
    // chasing the client for money already received.
    const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
    const recordedTotal = cents(entries.reduce((s, l) => s + l.amount, 0))
    if (stages?.final_invoice_paid && recordedTotal < total) {
      entries.push({ key: `${p.id}:paid-in-full`, paid_on: null, amount: cents(total - recordedTotal), label: 'Paid in full' })
    }

    const paid = cents(entries.reduce((s, l) => s + l.amount, 0))
    const balance = cents(total - paid)

    if (p.archived_at && balance <= 0) continue
    if (!includeSettled && balance <= 0) continue

    out.push({
      id: p.id,
      project_number: p.project_number,
      project_name: p.project_name,
      invoiced_date: p.invoiced_date,
      total,
      payments: entries,
      paid,
      balance,
    })
  }

  // Oldest work first, the way a statement reads.
  const sortKey = new Map(projects.map(p => [p.id, p.invoiced_date ?? p.quoted_date ?? p.created_at]))
  out.sort((a, b) => sortKey.get(a.id)!.localeCompare(sortKey.get(b.id)!))

  return {
    client: client as Client,
    projects: out,
    total: cents(out.reduce((s, p) => s + p.total, 0)),
    paid: cents(out.reduce((s, p) => s + p.paid, 0)),
    balance: cents(out.reduce((s, p) => s + p.balance, 0)),
  }
}
