export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Radio } from 'lucide-react'
import { BroadcastForm } from './BroadcastForm'

export default async function BroadcastPage() {
  // Get all active org admin emails grouped by plan
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, plan, subscription_status')
    .eq('status', 'active')
    .in('subscription_status', ['active', 'trialing'])

  const orgIds = (orgs ?? []).map(o => o.id)

  // Get admin member user_ids for each org
  const { data: adminMembers } = await supabaseAdmin
    .from('org_members')
    .select('org_id, user_id')
    .in('org_id', orgIds)
    .eq('role', 'admin')
    .eq('status', 'active')

  const orgById = new Map((orgs ?? []).map(o => [o.id, o]))
  const adminUserIds = (adminMembers ?? []).map(m => m.user_id).filter(Boolean)

  // Get emails from auth
  const userEmails: Record<string, string> = {}
  const batchSize = 50
  for (let i = 0; i < adminUserIds.length; i += batchSize) {
    const batch = adminUserIds.slice(i, i + batchSize)
    await Promise.all(batch.map(async (uid) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid)
      if (data.user?.email) userEmails[uid] = data.user.email
    }))
  }

  // Build recipient counts per filter
  const recipientEmails: Record<string, Set<string>> = {
    all: new Set(),
    solo: new Set(),
    studio: new Set(),
    agency: new Set(),
    trialing: new Set(),
  }

  for (const m of adminMembers ?? []) {
    const org = orgById.get(m.org_id)
    if (!org || !m.user_id) continue
    const email = userEmails[m.user_id]
    if (!email) continue

    recipientEmails.all.add(email)
    if (org.subscription_status === 'trialing') {
      recipientEmails.trialing.add(email)
    } else if (org.plan === 'solo') {
      recipientEmails.solo.add(email)
    } else if (org.plan === 'studio') {
      recipientEmails.studio.add(email)
    } else if (org.plan === 'agency') {
      recipientEmails.agency.add(email)
    }
  }

  const recipientCounts: Record<string, number> = {
    all: recipientEmails.all.size,
    solo: recipientEmails.solo.size,
    studio: recipientEmails.studio.size,
    agency: recipientEmails.agency.size,
    trialing: recipientEmails.trialing.size,
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Radio size={20} className="text-[#7E6036]" />
          <h1 className="font-serif text-3xl text-[#1A1A18]">Broadcast</h1>
        </div>
        <p className="text-sm text-[#6E6B63]">Send an email to your studios — product updates, announcements, or direct outreach.</p>
      </div>

      <BroadcastForm recipientCounts={recipientCounts} />
    </div>
  )
}
