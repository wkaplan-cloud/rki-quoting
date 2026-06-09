export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { MfgSettingsClient } from './MfgSettingsClient'
import type { MfgSettings } from '@/lib/mfg-types'
import type { PortalOrgMember } from '@/lib/elec-types'

export default async function MfgSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams
  const initialTab: 'business' | 'account' = params.tab === 'account' ? 'account' : 'business'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const account = await resolvePortalAccount(user.id)
  if (!account) redirect('/supplier-portal/login')

  const [
    { data: settings },
    { data: fullAccount },
    { data: orgMembers },
    { count: staffCount },
    { data: acctExtra },
  ] = await Promise.all([
    supabase.from('mfg_settings').select('*').eq('portal_account_id', account.id).maybeSingle(),
    supabaseAdmin.from('supplier_portal_accounts')
      .select('email, plan, subscription_status, trial_ends_at')
      .eq('id', account.id).single(),
    supabaseAdmin.from('portal_org_members')
      .select('*').eq('portal_account_id', account.id).order('invited_at', { ascending: false }),
    supabaseAdmin.from('elec_staff')
      .select('id', { count: 'exact', head: true }).eq('portal_account_id', account.id).eq('is_active', true),
    supabaseAdmin.from('supplier_portal_accounts')
      .select('setup_fee_paid').eq('id', account.id).single(),
  ])

  const setupFeePaid = (acctExtra as Record<string, unknown> | null)?.setup_fee_paid === true

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#18181B' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: '#71717A' }}>Business details, defaults, and account management.</p>
      </div>
      <MfgSettingsClient
        portalAccountId={account.id}
        settings={settings as MfgSettings | null}
        accountEmail={fullAccount?.email ?? ''}
        plan={fullAccount?.plan ?? null}
        subscriptionStatus={fullAccount?.subscription_status ?? null}
        trialEndsAt={fullAccount?.trial_ends_at ?? null}
        staffCount={staffCount ?? 0}
        setupFeePaid={setupFeePaid}
        orgMembers={(orgMembers ?? []) as PortalOrgMember[]}
        initialTab={initialTab}
      />
    </div>
  )
}
