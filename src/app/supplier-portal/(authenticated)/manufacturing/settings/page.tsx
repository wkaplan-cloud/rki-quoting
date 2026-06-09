export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgSettingsClient } from './MfgSettingsClient'
import type { MfgSettings } from '@/lib/mfg-types'

export default async function MfgSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  const { data: settings } = await supabase
    .from('mfg_settings')
    .select('*')
    .eq('portal_account_id', account.id)
    .maybeSingle()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#18181B' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: '#71717A' }}>Business identity, banking details, and document defaults.</p>
      </div>
      <MfgSettingsClient
        portalAccountId={account.id}
        settings={settings as MfgSettings | null}
      />
    </div>
  )
}
