import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'
import type { ElecSettings } from '@/lib/elec-types'

export default async function QuotingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!account) redirect('/supplier-portal/not-a-supplier')

  const { data: settings } = await supabaseAdmin
    .from('elec_settings')
    .select('*')
    .eq('portal_account_id', account.id)
    .maybeSingle()

  return <SettingsClient portalAccountId={account.id} settings={settings as ElecSettings | null} />
}
