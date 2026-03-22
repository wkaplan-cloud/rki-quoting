export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SupplierForm } from './SupplierForm'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  if (id === 'new') {
    return <div><PageHeader title="New Supplier" /><div className="p-8 max-w-2xl"><SupplierForm supplier={null} /></div></div>
  }
  const { data: supplier } = await supabase.from('suppliers').select('*').eq('id', id).single()
  if (!supplier) notFound()
  return (
    <div>
      <PageHeader title={supplier.supplier_name} subtitle={supplier.category ?? undefined} />
      <div className="p-8 max-w-2xl"><SupplierForm supplier={supplier} /></div>
    </div>
  )
}
