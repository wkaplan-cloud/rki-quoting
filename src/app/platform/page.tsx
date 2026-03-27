export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Building2, Users, FolderOpen, MessageSquare, TrendingUp } from 'lucide-react'

export default async function PlatformDashboard() {
  const [
    { count: studioCount },
    { count: userCount },
    { count: projectCount },
    { count: unreadCount },
    { data: recentStudios },
  ] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('org_members').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('contact_submissions').select('*', { count: 'exact', head: true }).eq('read', false),
    supabaseAdmin.from('organizations').select('id, name, created_at').order('created_at', { ascending: false }).limit(5),
  ])

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

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
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
