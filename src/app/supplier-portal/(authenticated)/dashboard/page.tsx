export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierDashboard } from './SupplierDashboard'

export default async function SupplierDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) redirect('/supplier-portal/login')

  // Fetch recipients matching this supplier's email
  const { data: recipients } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select(`
      id, supplier_name, email, status, sent_at, viewed_at, responded_at,
      sourcing_requests ( id, title, work_type, status, sent_at, user_id )
    `)
    .eq('email', portalAccount.email)
    .order('created_at', { ascending: false })

  // Collect studio names
  const userIds = [...new Set(
    (recipients ?? []).map(r => {
      const req = Array.isArray(r.sourcing_requests) ? r.sourcing_requests[0] : r.sourcing_requests
      return req?.user_id as string | undefined
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

  const rows = (recipients ?? []).map(r => {
    const req = Array.isArray(r.sourcing_requests) ? r.sourcing_requests[0] : r.sourcing_requests
    return {
      recipient_id: r.id,
      status: r.status as string,
      sent_at: r.sent_at,
      responded_at: r.responded_at,
      request: req ? { id: req.id, title: req.title, work_type: req.work_type, status: req.status } : null,
      studio_name: req?.user_id ? (studioMap[req.user_id] ?? 'Studio') : 'Studio',
    }
  })

  return <SupplierDashboard rows={rows} />
}
