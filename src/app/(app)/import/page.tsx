export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImportWizard } from './ImportWizard'

export default async function ImportPage() {
  const supabase = await createClient()

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  const { data: org } = orgId
    ? await supabaseAdmin.from('organizations').select('plan').eq('id', orgId).single()
    : { data: null }
  if (org?.plan === 'solo') redirect('/dashboard')

  const [{ data: projects }, { data: suppliers }, { data: clients }, { data: items }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('id, project_name, project_number').order('created_at', { ascending: false }),
    supabase.from('suppliers').select('id, supplier_name, markup_percentage').order('supplier_name'),
    supabase.from('clients').select('id, client_name').order('client_name'),
    supabase.from('items').select('id, item_name').order('item_name'),
    supabase.from('settings').select('business_name').maybeSingle(),
  ])

  const businessName = settings?.business_name ?? ''

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
          showLinesImport={businessName.toLowerCase().includes('kaplan')}
        />
      </div>
    </div>
  )
}
