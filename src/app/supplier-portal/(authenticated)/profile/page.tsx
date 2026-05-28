export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierProfileClient } from './SupplierProfileClient'
import type { PortalOrgMember } from '@/lib/elec-types'

const CATEGORY_OPTIONS = [
  'Upholstery', 'Curtains & Soft Furnishings', 'Furniture Manufacturing',
  'Carpets & Flooring', 'Lighting', 'Wallcoverings', 'Tiles & Stone',
  'Kitchens & Joinery', 'Blinds & Shutters', 'Artwork & Mirrors',
  'Outdoor Furniture', 'Fabrics & Textiles', 'Accessories & Decor', 'Other',
]

export default async function SupplierProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: account } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email, company_name, contact_name, phone, address, categories, description, website, logo_url, plan, subscription_status, trial_ends_at')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/login')

  const isTrialing = account.subscription_status === 'trialing' && account.trial_ends_at != null && new Date(account.trial_ends_at) > new Date()
  const hasQuoting = account.plan === 'quoting' && (account.subscription_status === 'active' || isTrialing)

  const [{ data: elecSettings }, { data: orgMembers }] = await Promise.all([
    supabaseAdmin
      .from('elec_settings')
      .select('cidb_registration_number, company_registration_number, vat_registration_number, bank_name, bank_account_number, bank_branch_code, bank_account_type')
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

  return (
    <SupplierProfileClient
      portalAccountId={account.id}
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
      elecSettings={elecSettings ?? null}
      categoryOptions={CATEGORY_OPTIONS}
      orgMembers={hasQuoting ? ((orgMembers ?? []) as PortalOrgMember[]) : null}
    />
  )
}
