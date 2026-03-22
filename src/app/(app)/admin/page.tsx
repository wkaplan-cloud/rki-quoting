export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { AdminPanel } from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('org_members')
    .select('role, org_id')
    .eq('user_id', user!.id)
    .eq('status', 'active')
    .maybeSingle()

  const [{ data: members }, { data: auditLogs }] = await Promise.all([
    supabase.from('org_members').select('*').order('invited_at'),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
  ])

  return (
    <div>
      <PageHeader title="Admin" subtitle="Manage your team and view activity" />
      <div className="p-8">
        <AdminPanel
          members={members ?? []}
          auditLogs={auditLogs ?? []}
          isAdmin={membership?.role === 'admin'}
        />
      </div>
    </div>
  )
}
