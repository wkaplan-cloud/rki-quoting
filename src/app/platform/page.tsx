export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2, Users, FolderOpen, MessageSquare, TrendingUp, AlertTriangle, DollarSign, Activity } from 'lucide-react'

export default async function PlatformDashboard() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString()

  const [
    { count: studioCount },
    { count: userCount },
    { count: projectCount },
    { count: unreadCount },
    { data: recentStudios },
    { data: orgs },
    { count: newProjectsCount },
  ] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('org_members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('contact_submissions').select('*', { count: 'exact', head: true }).eq('read', false),
    supabaseAdmin.from('organizations').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('organizations').select('id, plan, subscription_status, trial_ends_at').eq('status', 'active'),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
  ])

  // Sourcing fee stats
  const { data: acceptedAssignments } = await supabaseAdmin
    .from('sourcing_item_assignments')
    .select('response:sourcing_item_responses(unit_price), item:sourcing_session_items(session:sourcing_sessions(project:projects(status)))')
    .eq('status', 'accepted')

  let totalFeeCollectible = 0
  for (const a of acceptedAssignments ?? []) {
    const response = Array.isArray((a as any).response) ? (a as any).response[0] : (a as any).response
    const item = Array.isArray((a as any).item) ? (a as any).item[0] : (a as any).item
    const session = Array.isArray(item?.session) ? item?.session[0] : item?.session
    const project = Array.isArray(session?.project) ? session?.project[0] : session?.project
    if (['Paid', 'Completed'].includes(project?.status)) {
      totalFeeCollectible += (response?.unit_price ?? 0) * 0.01
    }
  }

  const activeOrgs = orgs ?? []
  const paidCount = activeOrgs.filter(o => o.subscription_status === 'active').length
  const trialCount = activeOrgs.filter(o => o.subscription_status === 'trialing').length
  const expiringTrials = activeOrgs.filter(o => {
    if (o.subscription_status !== 'trialing' || !o.trial_ends_at) return false
    const end = new Date(o.trial_ends_at)
    return end > now && end <= new Date(sevenDaysFromNow)
  })
  const expiredTrials = activeOrgs.filter(o => {
    if (o.subscription_status !== 'trialing' || !o.trial_ends_at) return false
    return new Date(o.trial_ends_at) < now
  })

  const fmt = (n: number) => `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const stats = [
    { label: 'Studios online', value: studioCount ?? 0, icon: Building2, color: 'text-[#C4A46B]' },
    { label: 'Total users', value: userCount ?? 0, icon: Users, color: 'text-blue-400' },
    { label: 'Total projects', value: projectCount ?? 0, icon: FolderOpen, color: 'text-emerald-400' },
    { label: 'Unread messages', value: unreadCount ?? 0, icon: MessageSquare, color: 'text-rose-400' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-white mb-1">Platform Overview</h1>
        <p className="text-sm text-white/40">QuotingHub CEO dashboard</p>
      </div>

      {/* Alerts */}
      {(expiringTrials.length > 0 || expiredTrials.length > 0) && (
        <div className="mb-6 space-y-2">
          {expiringTrials.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                <span className="font-semibold">{expiringTrials.length} trial{expiringTrials.length > 1 ? 's' : ''}</span> expiring within 7 days — consider reaching out
              </p>
            </div>
          )}
          {expiredTrials.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <p className="text-sm text-red-300">
                <span className="font-semibold">{expiredTrials.length} trial{expiredTrials.length > 1 ? 's' : ''}</span> expired and not converted
              </p>
            </div>
          )}
        </div>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <p className="text-3xl font-semibold text-white">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Paid subscriptions', value: paidCount.toString(), color: 'text-emerald-400', icon: Activity },
          { label: 'In trial', value: trialCount.toString(), color: 'text-[#C4A46B]', icon: Activity },
          { label: 'New projects (30d)', value: (newProjectsCount ?? 0).toString(), color: 'text-blue-400', icon: FolderOpen },
          { label: 'Fees collectible', value: fmt(totalFeeCollectible), color: 'text-[#C4A46B]', icon: DollarSign },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#1A1A18] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
              <Icon size={14} className={color} />
            </div>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent studios */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-[#C4A46B]" />
            <h2 className="text-sm font-medium text-white">Recently joined studios</h2>
          </div>
          <a href="/platform/studios" className="text-xs text-[#C4A46B] hover:underline">View all →</a>
        </div>
        <div className="divide-y divide-white/5">
          {recentStudios?.length === 0 && (
            <p className="px-5 py-6 text-sm text-white/30 text-center">No studios yet</p>
          )}
          {recentStudios?.map(studio => (
            <a
              key={studio.id}
              href={`/platform/studios/${studio.id}`}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm text-white">{studio.name}</span>
              <span className="text-xs text-white/30">
                {new Date(studio.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
