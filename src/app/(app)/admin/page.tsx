export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { AdminPanel } from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Use security definer to get org id (bypasses RLS)
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  // Fetch membership via admin client to bypass RLS
  const { data: membership } = await supabaseAdmin
    .from('org_members')
    .select('role, org_id')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .eq('status', 'active')
    .maybeSingle()

  // Non-admins and unauthenticated users get a 404
  if (membership?.role !== 'admin') notFound()

  const [{ data: members }, { data: auditLogs }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('org_members').select('*').eq('org_id', orgId).order('invited_at'),
    supabaseAdmin.from('audit_logs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
    supabase.from('settings').select('*').maybeSingle(),
  ])

  return (
    <div>
      <PageHeader title="Admin" subtitle="Manage your team, studio settings and activity" />
      <div className="p-8">
        <AdminPanel
          members={members ?? []}
          auditLogs={auditLogs ?? []}
          isAdmin={true}
          settings={settings}
        />
      </div>
    </div>
  )
}
