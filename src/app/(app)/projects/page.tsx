export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProjectsTable } from './ProjectsTable'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const [{ data: projects }, { data: orgIdResult }] = await Promise.all([
    supabase.from('projects')
      .select('*, client:clients(client_name, company), line_items(id, row_type, cost_price, markup_percentage, quantity, sale_price_override), stages:project_stages(*)')
      .order('created_at', { ascending: false })
      .order('archived_at', { ascending: false, nullsFirst: true }),
    supabase.rpc('get_current_org_id'),
  ])

  // Fetch members and current user in parallel — both depend on orgIdResult being ready
  const [{ data: members }, { data: { user } }] = await Promise.all([
    supabaseAdmin.from('org_members').select('user_id, invited_email, full_name').eq('org_id', orgIdResult).eq('status', 'active'),
    supabase.auth.getUser(),
  ])

  const userEmailMap: Record<string, string> = {}
  for (const m of members ?? []) {
    if (m.user_id) userEmailMap[m.user_id] = m.full_name ?? m.invited_email.split('@')[0]
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Projects"
        count={projects?.filter(p => !p.archived_at).length ?? 0}
        actions={
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-medium rounded hover:bg-[#9A7B4F] transition-colors"
          >
            <Plus size={15} /> New Project
          </Link>
        }
      />
      <div className="flex-1 p-8">
        <ProjectsTable projects={projects ?? []} userEmailMap={userEmailMap} currentUserId={user?.id ?? ''} />
      </div>
    </div>
  )
}
