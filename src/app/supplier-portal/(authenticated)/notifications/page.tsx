export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { NotificationsClient } from './NotificationsClient'
import type { ElecNotification } from '@/lib/elec-types'

export const metadata = { title: 'Notifications — QuotingHub' }

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

  const { data: notifications } = await supabaseAdmin
    .from('elec_notifications')
    .select('*')
    .eq('portal_account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <NotificationsClient
      portalAccountId={account.id}
      initialNotifications={(notifications ?? []) as ElecNotification[]}
    />
  )
}
