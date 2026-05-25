export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ElecQuoteStatus } from '@/lib/elec-types'

function fmtR(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMonth(yyyyMM01: string) {
  return new Date(yyyyMM01 + 'T12:00:00').toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
}

const S = {
  bg: '#F0F2F5', card: '#FFFFFF', accent: '#3A7CA5', gold: '#D9A441',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
  danger: '#DC2626', green: '#16A34A',
}

const STATUS_CFG: Partial<Record<ElecQuoteStatus, { label: string; bg: string; color: string }>> = {
  draft:       { label: 'Draft',       bg: '#F4F4F5', color: '#71717A' },
  quoted:      { label: 'Quoted',      bg: '#EFF6FF', color: '#1D4ED8' },
  approved:    { label: 'Approved',    bg: '#FEF9EC', color: '#92600A' },
  in_progress: { label: 'In Progress', bg: '#ECFDF5', color: '#15803D' },
  completed:   { label: 'Completed',   bg: '#F0FDF4', color: '#16A34A' },
  cancelled:   { label: 'Cancelled',   bg: '#FEF2F2', color: '#DC2626' },
}

type QuoteRow = {
  id: string
  quote_number: string
  project_name: string
  status: ElecQuoteStatus
  contract_type: string
  expected_completion_date: string | null
  client_name: string | null
  contract_value: number
  approved_vo_value: number
  as_built_value: number
}

type ClaimRow = {
  quote_id: string
  period_month: string
  claim_type: string
  total_claimed: number
  total_certified: number
  total_invoiced: number
  total_paid: number
  status: string
}

export default async function QuotingDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()
  if (!account) redirect('/supplier-portal/login')

  const [{ data: quotesRaw }, { data: claimsRaw }] = await Promise.all([
    supabaseAdmin
      .from('elec_quotes')
      .select('id, quote_number, project_name, status, contract_type, expected_completion_date, client:elec_clients(client_name), line_items:elec_quote_line_items(quoted_quantity, quoted_unit_rate, as_built_quantity, as_built_unit_rate), variation_orders:elec_variation_orders(status, value)')
      .eq('portal_account_id', account.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('elec_claims')
      .select('quote_id, period_month, claim_type, total_claimed, total_certified, total_invoiced, total_paid, status')
      .eq('portal_account_id', account.id),
  ])

  const quotes: QuoteRow[] = (quotesRaw ?? []).map((q: any) => {
    const client = Array.isArray(q.client) ? q.client[0] : q.client
    const lis: any[] = Array.isArray(q.line_items) ? q.line_items : []
    const vos: any[] = Array.isArray(q.variation_orders) ? q.variation_orders : []
    const contract_value = lis.reduce((s: number, li: any) => s + (li.quoted_quantity ?? 0) * (li.quoted_unit_rate ?? 0), 0)
    const approved_vo_value = vos.filter((v: any) => v.status === 'approved').reduce((s: number, v: any) => s + (v.value ?? 0), 0)
    const as_built_value = lis.reduce((s: number, li: any) => {
      const qty  = li.as_built_quantity  ?? li.quoted_quantity  ?? 0
      const rate = li.as_built_unit_rate ?? li.quoted_unit_rate ?? 0
      return s + qty * rate
    }, 0)
    return {
      id: q.id,
      quote_number: q.quote_number,
      project_name: q.project_name,
      status: q.status as ElecQuoteStatus,
      contract_type: q.contract_type ?? 'lump_sum',
      expected_completion_date: q.expected_completion_date ?? null,
      client_name: client?.client_name ?? null,
      contract_value,
      approved_vo_value,
      as_built_value,
    }
  })

  const claims: ClaimRow[] = (claimsRaw ?? []).map((c: any) => ({
    quote_id:        c.quote_id,
    period_month:    c.period_month,
    claim_type:      c.claim_type      ?? 'invoice',
    total_claimed:   c.total_claimed   ?? 0,
    total_certified: c.total_certified ?? 0,
    total_invoiced:  c.total_invoiced  ?? 0,
    total_paid:      c.total_paid      ?? 0,
    status:          c.status,
  }))

  // Per-quote claim totals (non-draft, progress claims only — exclude retention)
  const claimsByQuote: Record<string, { claimed: number; invoiced: number; paid: number }> = {}
  for (const c of claims) {
    if (c.status === 'draft' || c.claim_type === 'retention') continue
    if (!claimsByQuote[c.quote_id]) claimsByQuote[c.quote_id] = { claimed: 0, invoiced: 0, paid: 0 }
    claimsByQuote[c.quote_id].claimed  += c.total_claimed
    claimsByQuote[c.quote_id].invoiced += c.total_invoiced
    claimsByQuote[c.quote_id].paid     += c.total_paid
  }

  const pipeline      = quotes.filter(q => ['draft', 'quoted', 'approved'].includes(q.status))
  const active        = quotes.filter(q => q.status === 'in_progress')
  const pipelineValue = pipeline.reduce((s, q) => s + q.contract_value, 0)
  const activeValue   = active.reduce((s, q) => s + q.contract_value + q.approved_vo_value, 0)

  const year    = new Date().getFullYear().toString()
  const ytd     = claims.filter(c => c.status !== 'draft' && c.period_month.startsWith(year))
  const paidYTD = ytd.reduce((s, c) => s + c.total_paid, 0)

  // Outstanding = total claimed (sent to client) minus total paid, across all non-draft claims
  const nonDraft    = claims.filter(c => c.status !== 'draft')
  const totalSent   = nonDraft.reduce((s, c) => s + c.total_claimed, 0)
  const totalPaid   = nonDraft.reduce((s, c) => s + c.total_paid,    0)
  const outstanding = totalSent - totalPaid

  // Monthly RECON — non-draft, most recent 12
  const reconMap: Record<string, { claimed: number; certified: number; invoiced: number; paid: number }> = {}
  for (const c of claims) {
    if (c.status === 'draft') continue
    if (!reconMap[c.period_month]) reconMap[c.period_month] = { claimed: 0, certified: 0, invoiced: 0, paid: 0 }
    reconMap[c.period_month].claimed   += c.total_claimed
    reconMap[c.period_month].certified += c.total_certified
    reconMap[c.period_month].invoiced  += c.total_invoiced
    reconMap[c.period_month].paid      += c.total_paid
  }
  const reconMonths = Object.keys(reconMap).sort((a, b) => b.localeCompare(a)).slice(0, 12)

  const statCards = [
    { label: 'Pipeline',    value: fmtR(pipelineValue), sub: `${pipeline.length} quote${pipeline.length !== 1 ? 's' : ''}`, color: S.accent },
    { label: 'Active Jobs', value: fmtR(activeValue),   sub: `${active.length} job${active.length !== 1 ? 's' : ''}`,      color: S.green  },
    { label: 'Outstanding', value: fmtR(outstanding),   sub: 'Invoiced but not yet paid',                                   color: outstanding > 0 ? S.gold : S.muted },
    { label: 'Paid YTD',   value: fmtR(paidYTD),       sub: year,                                                          color: S.green  },
  ]

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: S.text }}>Quoting Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>
            {active.length} active · {pipeline.length} in pipeline
          </p>
        </div>
        <Link
          href="/supplier-portal/quoting/quotes"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
          style={{ background: S.accent, color: '#fff' }}
        >
          All Quotes
        </Link>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: S.muted }}>{card.label}</p>
            <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
            <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly RECON */}
      {reconMonths.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(58,124,165,0.04)' }}>
            <p className="text-sm font-semibold" style={{ color: S.text }}>Monthly RECON</p>
            <p className="text-[10px]" style={{ color: S.muted }}>Cash flow by claim period · last 12 months</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                  {['Month', 'Claimed', 'Certified', 'Invoiced', 'Paid', 'Outstanding'].map((h, hi) => (
                    <th key={h}
                      className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: S.muted, textAlign: hi === 0 ? 'left' : 'right' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconMonths.map((month, i) => {
                  const r = reconMap[month]
                  const outstanding = r.invoiced - r.paid
                  return (
                    <tr key={month} style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}>
                      <td className="px-4 py-2.5 text-xs font-medium" style={{ color: S.text }}>{fmtMonth(month)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(r.claimed)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono" style={{ color: S.muted }}>{fmtR(r.certified)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono" style={{ color: S.accent }}>{fmtR(r.invoiced)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono" style={{ color: S.green }}>{fmtR(r.paid)}</td>
                      <td className="px-4 py-2.5 text-xs text-right font-mono font-semibold"
                        style={{ color: outstanding > 0.01 ? S.gold : S.muted }}>
                        {fmtR(outstanding)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Jobs */}
      {active.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(58,124,165,0.04)' }}>
            <p className="text-sm font-semibold" style={{ color: S.text }}>Active Jobs</p>
          </div>
          {active.map((q, i) => {
            const ct = claimsByQuote[q.id] ?? { claimed: 0, invoiced: 0, paid: 0 }
            const adjustedContract = q.contract_value + q.approved_vo_value
            const balance = adjustedContract - ct.claimed
            const completionPct = adjustedContract > 0
              ? q.contract_type === 'lump_sum'
                ? Math.min(100, Math.round((ct.claimed / adjustedContract) * 100))
                : Math.min(100, Math.round((q.as_built_value / q.contract_value) * 100))
              : 0
            return (
              <Link
                key={q.id}
                href={`/supplier-portal/quoting/quotes/${q.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{q.project_name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ background: '#ECFDF5', color: '#15803D' }}>{q.quote_number}</span>
                  </div>
                  {q.client_name && (
                    <p className="text-xs mt-0.5" style={{ color: S.muted }}>{q.client_name}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: S.bg, width: '100px' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(completionPct, 100)}%`, background: S.accent }} />
                    </div>
                    <span className="text-[10px]" style={{ color: S.muted }}>{completionPct}% complete</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] mb-0.5" style={{ color: S.muted }}>Contract</p>
                  <p className="text-sm font-bold font-mono" style={{ color: S.text }}>{fmtR(adjustedContract)}</p>
                  <p className="text-[10px] mt-0.5 font-semibold"
                    style={{ color: balance > 0.01 ? S.gold : S.green }}>
                    {balance > 0.01 ? `To claim: ${fmtR(balance)}` : 'Fully claimed'}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pipeline */}
      {pipeline.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${S.border}`, background: 'rgba(58,124,165,0.04)' }}>
            <p className="text-sm font-semibold" style={{ color: S.text }}>Pipeline</p>
            <p className="text-[10px]" style={{ color: S.muted }}>Quotes not yet in progress</p>
          </div>
          {pipeline.map((q, i) => {
            const cfg = STATUS_CFG[q.status]
            return (
              <Link
                key={q.id}
                href={`/supplier-portal/quoting/quotes/${q.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[#F9FAFB]"
                style={{ borderTop: i > 0 ? `1px solid ${S.border}` : undefined }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: S.text }}>{q.project_name}</p>
                    {cfg && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                        style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    )}
                  </div>
                  {q.client_name && (
                    <p className="text-xs mt-0.5" style={{ color: S.muted }}>{q.client_name}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono" style={{ color: S.text }}>{fmtR(q.contract_value)}</p>
                  {q.expected_completion_date && (
                    <p className="text-[10px] mt-0.5" style={{ color: S.muted }}>
                      Due {new Date(q.expected_completion_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {quotes.length === 0 && (
        <div className="rounded-2xl py-14 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <p className="text-sm font-semibold mb-1" style={{ color: S.text }}>No quotes yet</p>
          <p className="text-xs mb-4" style={{ color: S.muted }}>Create your first quote to get started</p>
          <Link
            href="/supplier-portal/quoting/quotes"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: S.accent, color: '#fff' }}
          >
            Create Quote
          </Link>
        </div>
      )}
    </div>
  )
}
