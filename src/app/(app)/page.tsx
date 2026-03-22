export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatZAR, computeTotals } from '@/lib/quoting'
import Link from 'next/link'
import { Plus, FolderOpen, Users, Truck } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: projects }, { data: allLineItems }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(client_name)').order('created_at', { ascending: false }),
    supabase.from('line_items').select('project_id, cost_price, markup_percentage, quantity'),
  ])

  const ps = projects ?? []
  const totalProjects = ps.length
  const openQuotes = ps.filter(p => p.status === 'Quote').length
  const completedProjects = ps.filter(p => p.status === 'Completed')

  // Build totals per project for completed ones
  const lineItemsByProject = (allLineItems ?? []).reduce<Record<string, typeof allLineItems>>((acc, li) => {
    if (!acc[li.project_id]) acc[li.project_id] = []
    acc[li.project_id]!.push(li)
    return acc
  }, {})

  const totalRevenue = completedProjects.reduce((sum, p) => {
    const items = lineItemsByProject[p.id] ?? []
    const totals = computeTotals(items as any, p.design_fee ?? 0)
    return sum + totals.grand_total
  }, 0)

  const recent = ps.slice(0, 10)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/projects/new" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2C2C2A] text-[#F5F2EC] text-xs font-medium rounded hover:bg-[#9A7B4F] transition-colors">
              <Plus size={13} /> New Project
            </Link>
            <Link href="/clients/new" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D8D3C8] text-[#2C2C2A] text-xs font-medium rounded hover:border-[#2C2C2A] transition-colors">
              <Plus size={13} /> New Client
            </Link>
            <Link href="/suppliers/new" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#D8D3C8] text-[#2C2C2A] text-xs font-medium rounded hover:border-[#2C2C2A] transition-colors">
              <Plus size={13} /> New Supplier
            </Link>
          </div>
        }
      />

      <div className="p-8 space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-[#D8D3C8] rounded p-5">
            <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Total Projects</p>
            <p className="font-serif text-3xl text-[#1A1A18] mt-2">{totalProjects}</p>
          </div>
          <div className="bg-white border border-[#D8D3C8] rounded p-5">
            <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Open Quotes</p>
            <p className="font-serif text-3xl text-[#1A1A18] mt-2">{openQuotes}</p>
          </div>
          <div className="bg-white border border-[#D8D3C8] rounded p-5">
            <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Total Revenue</p>
            <p className="font-serif text-3xl text-[#1A1A18] mt-2">{formatZAR(totalRevenue)}</p>
            <p className="text-xs text-[#8A877F] mt-1">from {completedProjects.length} completed project{completedProjects.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Recent projects */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Recent Projects</h2>
            <Link href="/projects" className="text-xs text-[#9A7B4F] hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="bg-white border border-[#D8D3C8] rounded p-10 text-center">
              <FolderOpen size={36} className="text-[#D8D3C8] mx-auto mb-3" />
              <p className="text-[#8A877F] text-sm">No projects yet</p>
              <Link href="/projects/new" className="mt-2 inline-block text-sm text-[#9A7B4F] hover:underline">Create your first project →</Link>
            </div>
          ) : (
            <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC]">
                    {['Project', 'Client', 'Date', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-[#8A877F] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((p, i) => (
                    <tr key={p.id} className={`border-b border-[#EDE9E1] hover:bg-[#F5F2EC] ${i === recent.length - 1 ? 'border-0' : ''}`}>
                      <td className="px-4 py-3">
                        <Link href={`/projects/${p.id}`} className="font-medium text-[#2C2C2A] hover:text-[#9A7B4F]">{p.project_name}</Link>
                        <span className="text-[#8A877F] text-xs ml-2 font-mono">{p.project_number}</span>
                      </td>
                      <td className="px-4 py-3 text-[#8A877F]">{p.client?.client_name ?? '—'}</td>
                      <td className="px-4 py-3 text-[#8A877F]">{new Date(p.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
