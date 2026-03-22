export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImportWizard } from './ImportWizard'

export default async function ImportPage() {
  const supabase = await createClient()

  const [{ data: projects }, { data: suppliers }, { data: clients }, { data: items }] = await Promise.all([
    supabase.from('projects').select('id, project_name, project_number').order('created_at', { ascending: false }),
    supabase.from('suppliers').select('id, supplier_name, markup_percentage').order('supplier_name'),
    supabase.from('clients').select('id, client_name').order('client_name'),
    supabase.from('items').select('id, item_name').order('item_name'),
  ])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Import"
        subtitle="Import your data from Google Sheets CSV exports"
      />
      <div className="p-8">
        <ImportWizard
          projects={projects ?? []}
          existingSuppliers={suppliers ?? []}
          existingClients={clients ?? []}
          existingItems={items ?? []}
        />
      </div>
    </div>
  )
}
