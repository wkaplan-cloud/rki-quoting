export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { FolderOpen } from 'lucide-react'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  Draft:     { bg: '#EFEBE3', color: '#5C5A54' },
  Quote:     { bg: '#DDEDFA', color: '#0369A1' },
  Approved:  { bg: '#D6F5E3', color: '#047857' },
  Deposit:   { bg: '#EAE4FD', color: '#6D28D9' },
  Invoice:   { bg: '#FBEFD2', color: '#8F5706' },
  Paid:      { bg: '#D6F5E3', color: '#047857' },
  Completed: { bg: '#D6F5E3', color: '#047857' },
  Cancelled: { bg: '#FBE0E0', color: '#B91C1C' },
}

interface PlatformProjectRow {
  id: string
  project_name: string | null
  project_number: string | null
  status: string | null
  created_at: string
  org_id: string | null
}

export default async function PlatformQuotesPage() {
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id, project_name, project_number, status, created_at, org_id')
    .order('created_at', { ascending: false })
    .limit(500)

  const projectRows = (projects ?? []) as PlatformProjectRow[]
  const orgIds = [...new Set(projectRows.map(p => p.org_id).filter((id): id is string => Boolean(id)))]

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

  const rows = projectRows.map(p => ({
    id: p.id,
    project_name: p.project_name,
    project_number: p.project_number,
    status: p.status as string,
    created_at: p.created_at,
    studio: studioMap[p.org_id ?? ''] ?? '—',
  }))

  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  const statuses = ['Draft', 'Quote', 'Approved', 'Deposit', 'Invoice', 'Paid', 'Completed', 'Cancelled']

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <FolderOpen size={18} className="text-[#7E6036]" />
          <h1 className="font-serif text-3xl text-[#1A1A18]">Quote & Invoice Tracker</h1>
        </div>
        <p className="text-sm text-[#6E6B63]">All projects across every studio, by pipeline stage</p>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {statuses.map(s => {
          const badge = STATUS_BADGE[s] ?? STATUS_BADGE.Draft
          return (
            <div key={s} className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl p-4 text-center">
              <p className="text-2xl font-semibold text-[#1A1A18] mb-1">{byStatus[s] ?? 0}</p>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>{s}</span>
            </div>
          )
        })}
      </div>

      {/* Projects table */}
      <div className="bg-[#FDFCF9] border border-[#DED8CC] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#DED8CC]">
          <h2 className="text-sm font-medium text-[#1A1A18]">All Projects</h2>
          <p className="text-xs text-[#6E6B63] mt-0.5">{rows.length} total · sorted by most recent</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-sm text-[#6E6B63] text-center">No projects yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[34rem]">
              <thead>
                <tr className="border-b border-[#DED8CC]">
                  {['Studio', 'Project', 'Number', 'Status', 'Created'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[#6E6B63] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFEBE3]">
                {rows.map(row => {
                  const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.Draft
                  return (
                    <tr key={row.id} className="hover:bg-[#EFEBE3] transition-colors">
                      <td className="px-4 py-3 text-[#3F3D38] whitespace-nowrap">{row.studio}</td>
                      <td className="px-4 py-3 text-[#1A1A18] font-medium whitespace-nowrap max-w-[200px] truncate">{row.project_name}</td>
                      <td className="px-4 py-3 text-[#6E6B63] whitespace-nowrap font-mono text-xs">{row.project_number ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6E6B63] whitespace-nowrap text-xs">{fmtDate(row.created_at)}</td>
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
