export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2, Users, FolderOpen, ChevronRight } from 'lucide-react'
import Link from 'next/link'

function PlanBadge({ plan, status, trialEndsAt }: { plan: string; status: string; trialEndsAt: string | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 capitalize">
        {plan}
      </span>
    )
  }
  if (status === 'trialing') {
    const days = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0
    const expired = days === 0
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        expired ? 'bg-red-500/15 text-red-400' : 'bg-[#9A7B4F]/20 text-[#C4A46B]'
      }`}>
        {expired ? 'Trial expired' : `Trial · ${days}d left`}
      </span>
    )
  }
  if (status === 'cancelled') {
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/40">Cancelled</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/40">{status}</span>
}

export default async function StudiosPage() {
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, name, created_at, plan, trial_ends_at, subscription_status')
    .order('created_at', { ascending: false })

  const enriched = await Promise.all(
    (orgs ?? []).map(async (org) => {
      const [{ count: memberCount }, { data: adminMember }] = await Promise.all([
        supabaseAdmin.from('org_members').select('*', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'active'),
        supabaseAdmin.from('org_members').select('user_id, full_name, invited_email').eq('org_id', org.id).eq('role', 'admin').eq('status', 'active').maybeSingle(),
      ])

      let projectCount = 0
      if (adminMember?.user_id) {
        const { count } = await supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).eq('user_id', adminMember.user_id)
        projectCount = count ?? 0
      }

      let businessName = org.name
      if (adminMember?.user_id) {
        const { data: settings } = await supabaseAdmin.from('settings').select('business_name').eq('user_id', adminMember.user_id).maybeSingle()
        if (settings?.business_name) businessName = settings.business_name
      }

      return {
        ...org,
        businessName,
        memberCount: memberCount ?? 0,
        projectCount,
        adminName: adminMember?.full_name || adminMember?.invited_email || '—',
      }
    })
  )

  const trialCount = enriched.filter(o => o.subscription_status === 'trialing').length
  const activeCount = enriched.filter(o => o.subscription_status === 'active').length
  const expiredCount = enriched.filter(o => {
    if (o.subscription_status !== 'trialing') return false
    const days = o.trial_ends_at ? Math.max(0, Math.ceil((new Date(o.trial_ends_at).getTime() - Date.now()) / 86400000)) : 0
    return days === 0
  }).length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white mb-1">Studios</h1>
        <p className="text-sm text-white/40">{enriched.length} studio{enriched.length !== 1 ? 's' : ''} registered</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Active subscriptions', value: activeCount, color: 'text-emerald-400' },
          { label: 'In trial', value: trialCount, color: 'text-[#C4A46B]' },
          { label: 'Trial expired', value: expiredCount, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#1A1A18] border border-white/10 rounded-xl px-5 py-4">
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            <p className="text-xs text-white/40 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Studio / Business</th>
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Admin</th>
              <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">
                <div className="flex items-center justify-center gap-1"><Users size={11} /> Members</div>
              </th>
              <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">
                <div className="flex items-center justify-center gap-1"><FolderOpen size={11} /> Projects</div>
              </th>
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Plan</th>
              <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider font-medium">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {enriched.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-white/30 text-sm">No studios yet</td>
              </tr>
            )}
            {enriched.map(studio => (
              <tr key={studio.id} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-white font-medium">{studio.businessName}</p>
                  {studio.businessName !== studio.name && (
                    <p className="text-xs text-white/30 mt-0.5">{studio.name}</p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-white/60">{studio.adminName}</td>
                <td className="px-5 py-3.5 text-center text-white/60">{studio.memberCount}</td>
                <td className="px-5 py-3.5 text-center text-white/60">{studio.projectCount}</td>
                <td className="px-5 py-3.5">
                  <PlanBadge
                    plan={studio.plan ?? 'trial'}
                    status={studio.subscription_status ?? 'trialing'}
                    trialEndsAt={studio.trial_ends_at}
                  />
                </td>
                <td className="px-5 py-3.5 text-white/40 text-xs">
                  {new Date(studio.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/platform/studios/${studio.id}`} className="flex items-center gap-1 text-xs text-[#C4A46B] hover:underline">
                    Manage <ChevronRight size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
