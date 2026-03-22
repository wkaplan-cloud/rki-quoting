export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SuppliersTable } from './SuppliersTable'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase.from('suppliers').select('*').order('supplier_name')

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle={`${suppliers?.length ?? 0} suppliers`}
        actions={
          <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-medium rounded hover:bg-[#9A7B4F] transition-colors">
            <Plus size={15} /> New Supplier
          </Link>
        }
      />
      <div className="p-8">
        <SuppliersTable suppliers={suppliers ?? []} />
      </div>
    </div>
  )
}
