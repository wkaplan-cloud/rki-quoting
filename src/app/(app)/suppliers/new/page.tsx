import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierForm } from '../[id]/SupplierForm'

export default async function NewSupplierPage() {
  const supabase = await createClient()
  const { data: orgPriceLists } = await supabase
    .from('price_lists')
    .select('id, name')
    .eq('is_global', false)
    .order('name')

  return (
    <div>
      <PageHeader title="New Supplier" />
      <div className="p-6 lg:p-8"><SupplierForm supplier={null} platformContact={null} orgPriceLists={orgPriceLists ?? []} /></div>
    </div>
  )
}
