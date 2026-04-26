export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierDashboard } from './SupplierDashboard'

export default async function SupplierDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/login')

  const { data } = await supabaseAdmin
    .from('sourcing_session_suppliers')
    .select('id, supplier_name, status, sent_at, token, session:sourcing_sessions(id, title, status, user_id, project:projects(project_name))')
    .or(`portal_account_id.eq.${account.id},email.eq.${account.email}`)
    .order('created_at', { ascending: false })

  const userIds = [...new Set(
    (data ?? []).map((ss: any) => {
      const session = Array.isArray(ss.session) ? ss.session[0] : ss.session
      return session?.user_id as string | undefined
    }).filter(Boolean)
  )]

  const studioMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: settingsRows } = await supabaseAdmin
      .from('settings').select('user_id, business_name').in('user_id', userIds)
    for (const s of settingsRows ?? []) {
      if (s.user_id) studioMap[s.user_id] = s.business_name ?? 'Studio'
    }
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
      studio_name: session?.user_id ? (studioMap[session.user_id] ?? 'Studio') : 'Studio',
    }
  })

  return <SupplierDashboard rows={rows} />
}
