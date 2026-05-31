export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { resolvePortalAccount } from '@/lib/portal-account'
import { SettingsClient } from './SettingsClient'
import type { ElecSettings } from '@/lib/elec-types'

export default async function QuotingSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/not-a-supplier')

  const { data: settings } = await supabaseAdmin
    .from('elec_settings')
    .select('*')
    .eq('portal_account_id', account.id)
    .maybeSingle()

  return <SettingsClient portalAccountId={account.id} companyName={account.company_name ?? ''} settings={settings as ElecSettings | null} />
}
