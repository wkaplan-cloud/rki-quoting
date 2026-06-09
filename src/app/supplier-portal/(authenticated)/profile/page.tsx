export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolvePortalAccount } from '@/lib/portal-account'
import { isActivePlan, planRank } from '@/lib/plan-features'
import { SupplierProfileClient } from './SupplierProfileClient'
import type { PortalOrgMember } from '@/lib/elec-types'
import type { ElecSettings } from '@/lib/elec-types'

const CATEGORY_OPTIONS = [
  'Upholstery', 'Curtains & Soft Furnishings', 'Furniture Manufacturing',
  'Carpets & Flooring', 'Lighting', 'Wallcoverings', 'Tiles & Stone',
  'Kitchens & Joinery', 'Blinds & Shutters', 'Artwork & Mirrors',
  'Outdoor Furniture', 'Fabrics & Textiles', 'Accessories & Decor', 'Other',
]

export default async function SupplierProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string; upgraded?: string }> }) {
  const params = await searchParams
  const initialTab: 'profile' | 'settings' = params.tab === 'settings' ? 'settings' : 'profile'
  const justUpgraded = params.upgraded === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const base = await resolvePortalAccount(user.id)
  if (!base) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, address, categories, description, website, logo_url, plan, subscription_status, trial_ends_at')
    .eq('id', base.id)
    .single()

  if (!account) redirect('/supplier-portal/login')

  const hasQuoting = planRank(account.plan) >= 1 && isActivePlan(account.plan, account.subscription_status, account.trial_ends_at)
  const isManufacturer = base.plan_category === 'manufacturer' || base.supplier_category === 'manufacturer'

  const [{ data: elecSettings }, { data: orgMembers }] = await Promise.all([
    supabaseAdmin
      .from('elec_settings')
      .select('*')
      .eq('portal_account_id', account.id)
      .maybeSingle(),
    hasQuoting
      ? supabaseAdmin
          .from('portal_org_members')
          .select('*')
          .eq('portal_account_id', account.id)
          .order('invited_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const [{ data: acctExtra }, { count: staffCount }] = await Promise.all([
    supabaseAdmin.from('supplier_portal_accounts').select('setup_fee_paid').eq('id', base.id).single(),
    supabaseAdmin.from('elec_staff').select('id', { count: 'exact', head: true }).eq('portal_account_id', base.id).eq('is_active', true),
  ])
  const setupFeePaid = (acctExtra as Record<string, unknown> | null)?.setup_fee_paid === true

  return (
    <SupplierProfileClient
      portalAccountId={account.id}
      hasQuoting={hasQuoting}
      isManufacturer={isManufacturer}
      plan={account.plan ?? null}
      subscriptionStatus={account.subscription_status ?? null}
      trialEndsAt={account.trial_ends_at ?? null}
      staffCount={staffCount ?? 0}
      setupFeePaid={setupFeePaid}
      initialTab={initialTab}
      justUpgraded={justUpgraded}
      account={{
        email: account.email,
        company_name: account.company_name ?? '',
        contact_name: (account as any).contact_name ?? '',
        phone: account.phone ?? '',
        address: account.address ?? '',
        categories: (account.categories as string[]) ?? [],
        description: account.description ?? '',
        website: account.website ?? '',
        logo_url: (account as any).logo_url ?? null,
      }}
      elecSettings={(elecSettings as ElecSettings | null) ?? null}
      categoryOptions={CATEGORY_OPTIONS}
      orgMembers={hasQuoting ? ((orgMembers ?? []) as PortalOrgMember[]) : null}
    />
  )
}
