export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { PiecesClient } from './PiecesClient'

export default async function PiecesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (orgId) {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('plan')
      .eq('id', orgId)
      .single()
    if (org?.plan === 'solo') redirect('/projects')
  }

  const [
    { data: pieces },
    { data: suppliers },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from('pieces')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('suppliers')
      .select('id, supplier_name')
      .order('supplier_name'),
    supabase
      .from('projects')
      .select('id, project_name')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <div className="p-6 lg:p-8">
      <PiecesClient
        initialPieces={pieces ?? []}
        suppliers={suppliers ?? []}
        projects={projects ?? []}
      />
    </div>
  )
}
