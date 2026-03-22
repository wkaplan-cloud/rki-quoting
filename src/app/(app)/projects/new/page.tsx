export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { NewProjectForm } from './NewProjectForm'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, client_name, company')
    .order('client_name')

  return (
    <div>
      <PageHeader title="New Project" subtitle="Fill in the details to create a new project" />
      <div className="p-8 max-w-2xl">
        <NewProjectForm clients={clients ?? []} />
      </div>
    </div>
  )
}
