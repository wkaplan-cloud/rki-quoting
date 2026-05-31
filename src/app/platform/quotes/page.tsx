export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { FolderOpen } from 'lucide-react'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Draft:     { bg: '#1A1A18', color: '#71717A' },
  Quote:     { bg: '#1C2A3A', color: '#60A5FA' },
  Invoice:   { bg: '#2A1F0A', color: '#F59E0B' },
  Paid:      { bg: '#0A2A1A', color: '#34D399' },
  Completed: { bg: '#0A2A1A', color: '#34D399' },
  Cancelled: { bg: '#2A0A0A', color: '#F87171' },
}

export default async function PlatformQuotesPage() {
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id, project_name, project_number, status, created_at, org_id')
    .order('created_at', { ascending: false })
    .limit(500)

  const orgIds = [...new Set((projects ?? []).map((p: any) => p.org_id).filter(Boolean))]

  const studioMap: Record<string, string> = {}
  if (orgIds.length > 0) {
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('org_id, business_name')
      .in('org_id', orgIds)
    for (const s of settingsRows ?? []) {
      if (s.org_id) studioMap[s.org_id] = s.business_name ?? '—'
    }
  }

  const rows = (projects ?? []).map((p: any) => ({
    id: p.id,
    project_name: p.project_name,
    project_number: p.project_number,
    status: p.status as string,
    created_at: p.created_at,
    studio: studioMap[p.org_id] ?? '—',
  }))

  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const statuses = ['Draft', 'Quote', 'Invoice', 'Paid', 'Completed', 'Cancelled']

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <FolderOpen size={18} className="text-[#C4A46B]" />
          <h1 className="font-serif text-3xl text-white">Quote & Invoice Tracker</h1>
        </div>
        <p className="text-sm text-white/40">All projects across every studio, by pipeline stage</p>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {statuses.map(s => {
          const badge = STATUS_BADGE[s] ?? STATUS_BADGE.Draft
          return (
            <div key={s} className="bg-[#1A1A18] border border-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-white mb-1">{byStatus[s] ?? 0}</p>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>{s}</span>
            </div>
          )
        })}
      </div>

      {/* Projects table */}
      <div className="bg-[#1A1A18] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-white">All Projects</h2>
          <p className="text-xs text-white/30 mt-0.5">{rows.length} total · sorted by most recent</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-sm text-white/30 text-center">No projects yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Studio', 'Project', 'Number', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(row => {
                  const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.Draft
                  return (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-white/60 whitespace-nowrap">{row.studio}</td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap max-w-[200px] truncate">{row.project_name}</td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap font-mono text-xs">{row.project_number ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/40 whitespace-nowrap text-xs">{fmtDate(row.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
