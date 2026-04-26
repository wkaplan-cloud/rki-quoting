export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SupplierProfileClient } from './SupplierProfileClient'

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
    .select('id, email, company_name, phone, address, categories, description, website')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!account) redirect('/supplier-portal/login')

  return (
    <SupplierProfileClient
      account={{
        email: account.email,
        company_name: account.company_name ?? '',
        phone: account.phone ?? '',
        address: account.address ?? '',
        categories: (account.categories as string[]) ?? [],
        description: account.description ?? '',
        website: account.website ?? '',
      }}
      categoryOptions={CATEGORY_OPTIONS}
    />
  )
}
