export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClientsTable } from './ClientsTable'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase.from('clients').select('*').order('client_name')

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients?.length ?? 0} clients`}
        actions={
          <Link href="/clients/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-medium rounded hover:bg-[#9A7B4F] transition-colors">
            <Plus size={15} /> New Client
          </Link>
        }
      />
      <div className="p-8">
        <ClientsTable clients={clients ?? []} />
      </div>
    </div>
  )
}
