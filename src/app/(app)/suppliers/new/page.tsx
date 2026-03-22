export const dynamic = 'force-dynamic'
import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierForm } from '../[id]/SupplierForm'

export default function NewSupplierPage() {
  return (
    <div>
      <PageHeader title="New Supplier" />
      <div className="p-8 max-w-2xl"><SupplierForm supplier={null} /></div>
    </div>
  )
}
