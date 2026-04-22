export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SupplierForm } from './SupplierForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  if (id === 'new') {
    return <div><PageHeader title="New Supplier" /><div className="p-6 lg:p-8"><SupplierForm supplier={null} platformContact={null} /></div></div>
  }
  const { data: supplier } = await supabase.from('suppliers').select('*').eq('id', id).single()
  if (!supplier) notFound()

  let platformContact = null
  if (supplier.is_platform) {
    const { data } = await supabase
      .from('platform_supplier_contacts')
      .select('*')
      .eq('supplier_id', id)
      .maybeSingle()
    platformContact = data
  }

  return (
    <div>
      <PageHeader title={supplier.supplier_name} subtitle={supplier.category ?? undefined} />
      <div className="p-6 lg:p-8"><SupplierForm supplier={supplier} platformContact={platformContact} /></div>
    </div>
  )
}
