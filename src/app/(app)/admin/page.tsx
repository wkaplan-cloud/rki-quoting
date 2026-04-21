export const dynamic = 'force-dynamic'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { AdminPanel } from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: orgId } = await supabase.rpc('get_current_org_id')

  const { data: membership } = await supabaseAdmin
    .from('org_members')
    .select('role, org_id')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .eq('status', 'active')
    .maybeSingle()

  if (membership?.role !== 'admin') notFound()

  // Fetch org plan before heavy data load
  const { data: orgMeta } = await supabaseAdmin.from('organizations').select('plan').eq('id', orgId).single()
  if (orgMeta?.plan === 'solo') redirect('/dashboard')

  const [{ data: members }, { data: auditLogs }, { data: settings }, { data: org }, { data: completedProjects }] = await Promise.all([
    supabaseAdmin.from('org_members').select('*').eq('org_id', orgId).order('invited_at'),
    supabaseAdmin.from('audit_logs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
    supabase.from('settings').select('*').maybeSingle(),
    supabaseAdmin.from('organizations').select('plan, subscription_status').eq('id', orgId).single(),
    supabase.from('projects')
      .select('id, project_name, project_number, date, design_fee, vat_rate, client:clients(client_name), stages:project_stages(final_invoice_paid)')
      .order('date', { ascending: false }),
  ])

  // Fetch line items for completed projects
  // Only include projects where the final invoice has been paid
  const paidProjects = (completedProjects ?? []).filter(p => {
    const stages = Array.isArray(p.stages) ? p.stages[0] : p.stages
    return stages?.final_invoice_paid === true
  })

  const projectIds = paidProjects.map(p => p.id)
  const { data: completedLineItems } = projectIds.length > 0
    ? await supabase.from('line_items').select('project_id, cost_price, markup_percentage, quantity, row_type').in('project_id', projectIds)
    : { data: [] }

  return (
    <div>
      <PageHeader title="Admin" subtitle="Manage your team, studio settings and activity" />
      <div className="p-8">
        <AdminPanel
          members={members ?? []}
          auditLogs={auditLogs ?? []}
          isAdmin={true}
          settings={settings}
          plan={org?.plan ?? 'trial'}
          subscriptionStatus={org?.subscription_status ?? 'trialing'}
          completedProjects={paidProjects}
          completedLineItems={completedLineItems ?? []}
        />
      </div>
    </div>
  )
}
