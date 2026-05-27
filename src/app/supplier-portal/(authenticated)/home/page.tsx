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

  const allRows = ssRows ?? []
  const ssIds = allRows.map((r: any) => r.id)

  // Fetch studio names + assignment stats in parallel
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

  // Per-session-supplier pending count
  const pendingCountMap: Record<string, number> = {}
  let acceptedQuotes = 0
  for (const a of assignments ?? []) {
    const sid = (a as any).session_supplier_id
    if (a.status === 'pending') pendingCountMap[sid] = (pendingCountMap[sid] ?? 0) + 1
    if (a.status === 'accepted') acceptedQuotes++
  }

  const closedStatuses = new Set(['completed', 'declined'])

  // Enrich rows
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

  // Stats
  const activeRequests = enriched.filter(r => !r.isClosed).length
  const itemsToPrice = enriched.reduce((sum, r) => sum + r.pendingCount, 0)
  const studiosConnected = new Set(enriched.map(r => r.studioName)).size

  // Needs attention: open rows with items still to price
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

  // Recent requests: last 5 sent (with a sent_at date)
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

  return (
    <HomeClient
      companyName={companyName}
      hasQuoting={hasQuoting}
      stats={{ activeRequests, itemsToPrice, studiosConnected, acceptedQuotes }}
      needsAttention={needsAttention}
      recentRequests={recentRequests}
    />
  )
}
