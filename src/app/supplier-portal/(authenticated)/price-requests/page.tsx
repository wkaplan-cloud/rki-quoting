export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { SupplierDashboard } from '../dashboard/SupplierDashboard'

export default async function SupplierDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  const { data } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('id, supplier_name, status, sent_at, token, session:sourcing_sessions(id, title, status, org_id, project:projects(project_name))')
    .or(`portal_account_id.eq.${account.id},email.eq.${account.email}`)
    .order('created_at', { ascending: false })

  const orgIds = [...new Set(
    (data ?? []).map((ss: any) => {
      const session = Array.isArray(ss.session) ? ss.session[0] : ss.session
      return session?.org_id as string | undefined
    }).filter(Boolean)
  )]

  const studioMap: Record<string, string> = {}
  if (orgIds.length > 0) {
    const { data: settingsRows } = await supabaseAdmin
      .from('settings').select('org_id, business_name').in('org_id', orgIds)
    for (const s of settingsRows ?? []) {
      if (s.org_id) studioMap[s.org_id] = s.business_name ?? 'Studio'
    }
  }

  const ssIds = (data ?? []).map((ss: any) => ss.id)

  const [{ data: allMessages }, { data: pendingAssignments }] = await Promise.all([
    ssIds.length > 0
      ? supabaseAdmin
          .from('sourcing_thread_messages')
          .select('session_supplier_id, sender_type, created_at')
          .in('session_supplier_id', ssIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as { session_supplier_id: string; sender_type: string; created_at: string }[] }),
    ssIds.length > 0
      ? supabaseAdmin
          .from('sourcing_item_assignments')
          .select('session_supplier_id')
          .in('session_supplier_id', ssIds)
          .eq('status', 'pending')
      : Promise.resolve({ data: [] as { session_supplier_id: string }[] }),
  ])

  // Build a map of designer message timestamps per thread.
  // The client component uses localStorage to track when the supplier last opened each thread,
  // and computes unread count from timestamps newer than that stored time.
  const designerTimestampsMap: Record<string, string[]> = {}
  for (const m of allMessages ?? []) {
    const sid = (m as any).session_supplier_id
    if (m.sender_type !== 'designer') continue
    if (!designerTimestampsMap[sid]) designerTimestampsMap[sid] = []
    designerTimestampsMap[sid].push(m.created_at)
  }

  const pendingCountMap: Record<string, number> = {}
  for (const a of pendingAssignments ?? []) {
    const sid = (a as any).session_supplier_id
    pendingCountMap[sid] = (pendingCountMap[sid] ?? 0) + 1
  }

  const rows = (data ?? []).map((ss: any) => {
    const session = Array.isArray(ss.session) ? ss.session[0] : ss.session
    return {
      id: ss.id,
      status: ss.status as string,
      sent_at: ss.sent_at as string | null,
      token: ss.token as string,
      session: session ? {
        id: session.id,
        title: session.title,
        status: session.status,
        project_name: (session.project as any)?.project_name ?? null,
      } : null,
      studio_name: session?.org_id ? (studioMap[session.org_id] ?? 'Studio') : 'Studio',
      designer_message_timestamps: designerTimestampsMap[ss.id] ?? [],
      pending_item_count: pendingCountMap[ss.id] ?? 0,
    }
  })

  return <SupplierDashboard rows={rows} />
}
