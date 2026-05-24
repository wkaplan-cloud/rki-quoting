export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { CommissionsPanel, type OrgRow } from './CommissionsPanel'

export default async function CommissionsPage() {
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, plan, subscription_status, created_at, assigned_rep, rep_upfront_paid, rep_monthly_last_paid_at, is_internal')
    .eq('status', 'active')
    .eq('is_internal', false)
    .not('assigned_rep', 'is', null)
    .order('created_at', { ascending: false })

  const enriched: OrgRow[] = await Promise.all(
    (orgs ?? []).map(async org => {
      const { data: adminMember } = await supabaseAdmin
        .from('org_members')
        .select('user_id')
        .eq('org_id', org.id)
        .eq('role', 'admin')
        .eq('status', 'active')
        .maybeSingle()

      let businessName = org.name
      if (adminMember?.user_id) {
        const { data: settings } = await supabaseAdmin
          .from('settings')
          .select('business_name')
          .eq('user_id', adminMember.user_id)
          .maybeSingle()
        if (settings?.business_name) businessName = settings.business_name
      }

      return {
        id: org.id,
        businessName,
        plan: org.plan,
        subscription_status: org.subscription_status,
        created_at: org.created_at,
        assigned_rep: org.assigned_rep,
        rep_upfront_paid: org.rep_upfront_paid,
        rep_monthly_last_paid_at: org.rep_monthly_last_paid_at,
      }
    })
  )

  return <CommissionsPanel orgs={enriched} />
}
