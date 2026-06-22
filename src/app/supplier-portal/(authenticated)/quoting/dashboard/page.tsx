export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { resolvePortalAccount } from '@/lib/portal-account'
import { planRank } from '@/lib/plan-features'
import type { ElecQuoteStatus } from '@/lib/elec-types'
import { QuotingDashboardClient } from '../QuotingDashboardClient'
import { ClockingDashboardClient } from '../ClockingDashboardClient'

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
  claimed: number
  invoiced: number
  paid: number
}

type ReconEntry = {
  claimed: number
  certified: number
  invoiced: number
  paid: number
}

type JobCardRow = {
  id: string
  job_number: string
  title: string
  status: string
  job_type: string
  client_name: string | null
  scheduled_at: string | null
  completed_at: string | null
  materials_value: number
  total_charge: number
}

export default async function QuotingDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  // Starter plan: show clocking dashboard instead
  if (planRank(account.plan) === 1) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); weekStart.setHours(0, 0, 0, 0)

    const [{ data: staffData }, { data: todayPunchData }, { data: weekPunchData }] = await Promise.all([
      supabaseAdmin.from('elec_staff').select('id, name, color, role').eq('portal_account_id', account.id).eq('is_active', true).order('name'),
      supabaseAdmin.from('elec_time_punches').select('id, staff_id, punch_type, punched_at, latitude, longitude, notes').eq('portal_account_id', account.id).gte('punched_at', todayStart.toISOString()).order('punched_at', { ascending: false }),
      supabaseAdmin.from('elec_time_punches').select('id, staff_id, punch_type, punched_at').eq('portal_account_id', account.id).gte('punched_at', weekStart.toISOString()).order('punched_at'),
    ])

    return (
      <ClockingDashboardClient
        companyName={account.company_name ?? account.email ?? ''}
        staff={(staffData ?? []) as { id: string; name: string; color: string; role: string }[]}
        todayPunches={(todayPunchData ?? []) as never[]}
        weekPunches={(weekPunchData ?? []) as never[]}
      />
    )
  }

  const [{ data: quotesRaw }, { data: claimsRaw }, { data: jobCardsRaw }] = await Promise.all([
    supabaseAdmin
      .from('elec_quotes')
      .select('id, quote_number, project_name, status, contract_type, expected_completion_date, client:elec_clients(client_name), line_items:elec_quote_line_items(quoted_quantity, quoted_unit_rate, labour_rate, as_built_quantity, as_built_unit_rate), variation_orders:elec_variation_orders(status, value)')
      .eq('portal_account_id', account.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('elec_claims')
      .select('quote_id, period_month, claim_type, total_claimed, total_certified, total_invoiced, total_paid, status')
      .eq('portal_account_id', account.id),
    supabaseAdmin
      .from('elec_job_cards')
      .select('id, job_number, title, status, job_type, client_name, scheduled_at, completed_at, callout_fee, labour_hours, labour_rate, materials:elec_job_card_materials(qty, unit_price)')
      .eq('portal_account_id', account.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // ── Claims rollup ─────────────────────────────────────────────────────────
  const claimsByQuote: Record<string, { claimed: number; invoiced: number; paid: number }> = {}
  const reconMap: Record<string, ReconEntry> = {}

  for (const c of claimsRaw ?? []) {
    if ((c as any).status === 'draft' || (c as any).claim_type === 'retention') continue
    const qid = (c as any).quote_id as string
    if (!claimsByQuote[qid]) claimsByQuote[qid] = { claimed: 0, invoiced: 0, paid: 0 }
    claimsByQuote[qid].claimed  += (c as any).total_claimed  ?? 0
    claimsByQuote[qid].invoiced += (c as any).total_invoiced ?? 0
    claimsByQuote[qid].paid     += (c as any).total_paid     ?? 0

    const month = (c as any).period_month as string
    if (month) {
      if (!reconMap[month]) reconMap[month] = { claimed: 0, certified: 0, invoiced: 0, paid: 0 }
      reconMap[month].claimed   += (c as any).total_claimed   ?? 0
      reconMap[month].certified += (c as any).total_certified ?? 0
      reconMap[month].invoiced  += (c as any).total_invoiced  ?? 0
      reconMap[month].paid      += (c as any).total_paid      ?? 0
    }
  }

  const reconMonths = Object.keys(reconMap).sort((a, b) => b.localeCompare(a)).slice(0, 12)

  // ── Quotes ────────────────────────────────────────────────────────────────
  const quotes: QuoteRow[] = (quotesRaw ?? []).map((q: any) => {
    const client = Array.isArray(q.client) ? q.client[0] : q.client
    const lis: any[] = Array.isArray(q.line_items) ? q.line_items : []
    const vos: any[] = Array.isArray(q.variation_orders) ? q.variation_orders : []
    const contract_value = lis.reduce((s: number, li: any) =>
      s + (li.quoted_quantity ?? 0) * ((li.quoted_unit_rate ?? 0) + (li.labour_rate ?? 0)), 0)
    const approved_vo_value = vos.filter((v: any) => v.status === 'approved').reduce((s: number, v: any) => s + (v.value ?? 0), 0)
    const ct = claimsByQuote[q.id] ?? { claimed: 0, invoiced: 0, paid: 0 }
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
      claimed:  ct.claimed,
      invoiced: ct.invoiced,
      paid:     ct.paid,
    }
  })

  const pipeline  = quotes.filter(q => ['draft', 'quoted', 'approved'].includes(q.status))
  const active    = quotes.filter(q => q.status === 'in_progress')
  const completed = quotes.filter(q => q.status === 'completed')

  const pipelineValue  = pipeline.reduce((s, q) => s + q.contract_value, 0)
  const activeValue    = active.reduce((s, q) => s + q.contract_value + q.approved_vo_value, 0)
  const completedValue = completed.reduce((s, q) => s + q.contract_value + q.approved_vo_value, 0)

  const year        = new Date().getFullYear().toString()
  const allClaims   = (claimsRaw ?? []) as any[]
  const paidYTD     = allClaims.filter(c => c.status !== 'draft' && (c.period_month as string)?.startsWith(year)).reduce((s, c) => s + (c.total_paid ?? 0), 0)
  const nonDraft    = allClaims.filter(c => c.status !== 'draft')
  const totalSent   = nonDraft.reduce((s, c) => s + (c.total_claimed ?? 0), 0)
  const totalPaid   = nonDraft.reduce((s, c) => s + (c.total_paid ?? 0), 0)
  const outstanding = totalSent - totalPaid

  // ── Job cards ─────────────────────────────────────────────────────────────
  const jobCards: JobCardRow[] = (jobCardsRaw ?? []).map((jc: any) => {
    const materials: any[] = Array.isArray(jc.materials) ? jc.materials : []
    const materials_value = materials.reduce((s: number, m: any) => s + (m.qty ?? 0) * (m.unit_price ?? 0), 0)
    const labour_charge = (jc.labour_hours ?? 0) * (jc.labour_rate ?? 0)
    const total_charge = (jc.callout_fee ?? 0) + labour_charge + materials_value
    return {
      id: jc.id,
      job_number: jc.job_number,
      title: jc.title,
      status: jc.status,
      job_type: jc.job_type,
      client_name: jc.client_name ?? null,
      scheduled_at: jc.scheduled_at ?? null,
      completed_at: jc.completed_at ?? null,
      materials_value,
      total_charge,
    }
  })

  const jcPending    = jobCards.filter(jc => jc.status === 'pending')
  const jcInProgress = jobCards.filter(jc => jc.status === 'in_progress')
  const jcCompleted  = jobCards.filter(jc => jc.status === 'completed')
  const jcRevenue    = jcCompleted.reduce((s, jc) => s + jc.total_charge, 0)

  return (
    <QuotingDashboardClient
      financial={{ pipelineValue, activeValue, completedValue, outstanding, paidYTD }}
      pipeline={pipeline}
      active={active}
      completed={completed}
      reconMonths={reconMonths}
      reconMap={reconMap}
      jobCards={{
        pending:     jcPending,
        in_progress: jcInProgress,
        completed:   jcCompleted.slice(0, 10),
      }}
      jobCardSummary={{
        pendingCount:     jcPending.length,
        inProgressCount:  jcInProgress.length,
        completedCount:   jcCompleted.length,
        totalRevenue:     jcRevenue,
      }}
    />
  )
}
