export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { HomeClient } from './HomeClient'

export default async function SupplierHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, company_name, email, plan, subscription_status, trial_ends_at')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/login')

  const companyName = account.company_name ?? account.email
  const isTrialing = account.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  const hasQuoting = account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing)

  // Fetch all session-supplier rows for this account
  const { data: ssRows } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('id, status, sent_at, token, session:sourcing_sessions(id, title, status, org_id, request_number, project:projects(project_name))')
    .or(`portal_account_id.eq.${account.id},email.eq.${account.email}`)
    .order('created_at', { ascending: false })
    .limit(200)

  const allRows = ssRows ?? []
  const ssIds = allRows.map((r: any) => r.id)

  const orgIds = [...new Set(
    allRows.map((r: any) => {
      const s = Array.isArray(r.session) ? r.session[0] : r.session
      return s?.org_id as string | undefined
    }).filter(Boolean)
  )]

  const [{ data: settingsRows }, { data: assignments }] = await Promise.all([
    orgIds.length > 0
      ? supabaseAdmin.from('settings').select('org_id, business_name').in('org_id', orgIds)
      : Promise.resolve({ data: [] as { org_id: string; business_name: string | null }[] }),
    ssIds.length > 0
      ? supabaseAdmin
          .from('sourcing_item_assignments')
          .select('session_supplier_id, status')
          .in('session_supplier_id', ssIds)
      : Promise.resolve({ data: [] as { session_supplier_id: string; status: string }[] }),
  ])

  const studioMap: Record<string, string> = {}
  for (const s of settingsRows ?? []) {
    if (s.org_id) studioMap[s.org_id] = s.business_name ?? 'Studio'
  }

  const pendingCountMap: Record<string, number> = {}
  let acceptedQuotes = 0
  for (const a of assignments ?? []) {
    const sid = (a as any).session_supplier_id
    if (a.status === 'pending') pendingCountMap[sid] = (pendingCountMap[sid] ?? 0) + 1
    if (a.status === 'accepted') acceptedQuotes++
  }

  const closedStatuses = new Set(['completed', 'declined'])

  const enriched = allRows.map((r: any) => {
    const session = Array.isArray(r.session) ? r.session[0] : r.session
    const studioName = session?.org_id ? (studioMap[session.org_id] ?? 'Studio') : 'Studio'
    const reqNum = session?.request_number ?? null
    return {
      id: r.id as string,
      token: r.token as string,
      status: r.status as string,
      sentAt: r.sent_at as string | null,
      sessionTitle: session?.title ?? '—',
      requestRef: reqNum ? `PR-${String(reqNum).padStart(3, '0')}` : null,
      studioName,
      pendingCount: pendingCountMap[r.id] ?? 0,
      isClosed: closedStatuses.has(r.status as string),
    }
  })

  const activeRequests = enriched.filter(r => !r.isClosed).length
  const itemsToPrice = enriched.reduce((sum, r) => sum + r.pendingCount, 0)
  const studiosConnected = new Set(enriched.map(r => r.studioName)).size

  const needsAttention = enriched
    .filter(r => !r.isClosed && r.pendingCount > 0)
    .slice(0, 5)
    .map(r => ({
      id: r.id,
      token: r.token,
      studioName: r.studioName,
      sessionTitle: r.sessionTitle,
      requestRef: r.requestRef,
      pendingCount: r.pendingCount,
    }))

  const recentRequests = enriched
    .filter(r => r.sentAt)
    .slice(0, 5)
    .map(r => ({
      id: r.id,
      token: r.token,
      studioName: r.studioName,
      sessionTitle: r.sessionTitle,
      requestRef: r.requestRef,
      status: r.status,
      sentAt: r.sentAt,
    }))

  // ── Quoting dashboard data (electricians only) ──────────────────────────────
  let quotingDashboard: import('./HomeClient').QuotingDashboard | null = null

  if (hasQuoting) {
    const [{ data: quotesRaw }, { data: claimsRaw }, { data: jobCardsRaw }] = await Promise.all([
      supabaseAdmin
        .from('elec_quotes')
        .select('id, quote_number, project_name, status, expected_completion_date, client:elec_clients(client_name), line_items:elec_quote_line_items(quoted_quantity, quoted_unit_rate), variation_orders:elec_variation_orders(status, value)')
        .eq('portal_account_id', account.id)
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('elec_claims')
        .select('quote_id, period_month, total_claimed, total_invoiced, total_paid, status')
        .eq('portal_account_id', account.id),
      supabaseAdmin
        .from('elec_job_cards')
        .select('id, job_number, title, status, job_type, client_name, scheduled_at, completed_at, materials:elec_job_card_materials(qty, unit_price)')
        .eq('portal_account_id', account.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const quotes = (quotesRaw ?? []).map((q: any) => {
      const client = Array.isArray(q.client) ? q.client[0] : q.client
      const lis: any[] = Array.isArray(q.line_items) ? q.line_items : []
      const vos: any[] = Array.isArray(q.variation_orders) ? q.variation_orders : []
      const contract_value = lis.reduce((s: number, li: any) => s + (li.quoted_quantity ?? 0) * (li.quoted_unit_rate ?? 0), 0)
      const approved_vo_value = vos.filter((v: any) => v.status === 'approved').reduce((s: number, v: any) => s + (v.value ?? 0), 0)
      return {
        id: q.id as string,
        quote_number: q.quote_number as string,
        project_name: q.project_name as string,
        status: q.status as string,
        expected_completion_date: (q.expected_completion_date ?? null) as string | null,
        client_name: (client?.client_name ?? null) as string | null,
        contract_value,
        approved_vo_value,
      }
    })

    const claims = (claimsRaw ?? []) as any[]
    const nonDraft = claims.filter((c: any) => c.status !== 'draft')
    const year = new Date().getFullYear().toString()
    const paidYTD = nonDraft
      .filter((c: any) => (c.period_month as string)?.startsWith(year))
      .reduce((s: number, c: any) => s + (c.total_paid ?? 0), 0)
    const totalSent = nonDraft.reduce((s: number, c: any) => s + (c.total_claimed ?? 0), 0)
    const totalPaid = nonDraft.reduce((s: number, c: any) => s + (c.total_paid ?? 0), 0)
    const outstanding = totalSent - totalPaid

    const pipeline = quotes.filter(q => ['draft', 'quoted', 'approved'].includes(q.status))
    const active   = quotes.filter(q => q.status === 'in_progress')
    const completed = quotes.filter(q => q.status === 'completed')

    const pipelineValue = pipeline.reduce((s, q) => s + q.contract_value, 0)
    const activeValue   = active.reduce((s, q) => s + q.contract_value + q.approved_vo_value, 0)

    const jobCards = (jobCardsRaw ?? []).map((jc: any) => {
      const materials: any[] = Array.isArray(jc.materials) ? jc.materials : []
      const materials_value = materials.reduce((s: number, m: any) => s + (m.qty ?? 0) * (m.unit_price ?? 0), 0)
      return {
        id: jc.id as string,
        job_number: jc.job_number as string,
        title: jc.title as string,
        status: jc.status as string,
        job_type: jc.job_type as string,
        client_name: (jc.client_name ?? null) as string | null,
        scheduled_at: (jc.scheduled_at ?? null) as string | null,
        completed_at: (jc.completed_at ?? null) as string | null,
        materials_value,
      }
    })

    quotingDashboard = {
      financial: { pipelineValue, activeValue, outstanding, paidYTD },
      pipeline: pipeline.slice(0, 10),
      active,
      completedQuotes: completed.slice(0, 5),
      jobCards: {
        pending:     jobCards.filter(jc => jc.status === 'pending'),
        in_progress: jobCards.filter(jc => jc.status === 'in_progress'),
        completed:   jobCards.filter(jc => jc.status === 'completed').slice(0, 5),
      },
    }
  }

  return (
    <HomeClient
      companyName={companyName}
      hasQuoting={hasQuoting}
      stats={{ activeRequests, itemsToPrice, studiosConnected, acceptedQuotes }}
      needsAttention={needsAttention}
      recentRequests={recentRequests}
      quotingDashboard={quotingDashboard}
    />
  )
}
