import { PageHeader } from '@/components/layout/PageHeader'
import { SupplierForm } from '../[id]/SupplierForm'

export default function NewSupplierPage() {
  return (
    <div>
      <PageHeader title="New Supplier" />
      <div className="p-6 lg:p-8"><SupplierForm supplier={null} platformContact={null} /></div>
    </div>
  )
}
