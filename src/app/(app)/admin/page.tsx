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
    .select('role, org_id, full_name')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .eq('status', 'active')
    .maybeSingle()

  // Fetch org plan — solo users redirect to dashboard
  const { data: orgMeta } = await supabaseAdmin.from('organizations').select('plan').eq('id', orgId).single()
  if (orgMeta?.plan === 'solo') redirect('/dashboard')

  const isAdmin = membership?.role === 'admin'
  const meta = (user.user_metadata ?? {}) as Record<string, string>
  const userProfile = {
    fullName: membership?.full_name ?? meta.full_name ?? '',
    email: user.email ?? '',
    phone: meta.phone ?? '',
    jobTitle: meta.job_title ?? '',
  }

  // Non-admins: profile-only view
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="My Account" subtitle="Manage your profile" />
        <div className="p-8">
          <AdminPanel
            members={[]}
            auditLogs={[]}
            isAdmin={false}
            settings={null}
            plan={orgMeta?.plan ?? 'trial'}
            subscriptionStatus={'active'}
            completedProjects={[]}
            completedLineItems={[]}
            userProfile={userProfile}
          />
        </div>
      </div>
    )
  }

  const [{ data: members }, { data: auditLogs }, { data: settings }, { data: org }, { data: completedProjects }] = await Promise.all([
    supabaseAdmin.from('org_members').select('*').eq('org_id', orgId).order('invited_at'),
    supabaseAdmin.from('audit_logs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100),
    supabase.from('settings').select('*').maybeSingle(),
    supabaseAdmin.from('organizations').select('plan, subscription_status').eq('id', orgId).single(),
    supabase.from('projects')
      .select('id, project_name, project_number, date, design_fee, vat_rate, client:clients(client_name), stages:project_stages(final_invoice_paid)')
      .order('date', { ascending: false }),
  ])

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
          userProfile={userProfile}
        />
      </div>
    </div>
  )
}
