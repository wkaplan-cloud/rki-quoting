export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ClientsClient } from './ClientsClient'
import type { ElecClient } from '@/lib/elec-types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!account) redirect('/supplier-portal/not-a-supplier')

  const { data: clients } = await supabaseAdmin
    .from('elec_clients')
    .select('*')
    .eq('portal_account_id', account.id)
    .order('client_name')

  return <ClientsClient portalAccountId={account.id} initialClients={(clients ?? []) as ElecClient[]} />
}
