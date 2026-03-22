export const dynamic = 'force-dynamic'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClientForm } from '../[id]/ClientForm'

export default function NewClientPage() {
  return (
    <div>
      <PageHeader title="New Client" />
      <div className="p-8 max-w-2xl">
        <ClientForm client={null} projects={[]} />
      </div>
    </div>
  )
}
