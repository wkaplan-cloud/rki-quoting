export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatZAR, computeTotals } from '@/lib/quoting'
import { STAGE_CONFIG } from '@/lib/types'
import { KanbanBoard } from './KanbanBoard'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: projects }, { data: allLineItems }, { data: stages }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(client_name)').order('created_at', { ascending: false }),
    supabase.from('line_items').select('project_id, cost_price, markup_percentage, quantity'),
    supabase.from('project_stages').select('*'),
  ])

  const ps = projects ?? []
  const stagesMap = Object.fromEntries((stages ?? []).map(s => [s.project_id, s]))

  const lineItemsByProject = (allLineItems ?? []).reduce<Record<string, typeof allLineItems>>((acc, li) => {
    if (!acc[li!.project_id]) acc[li!.project_id] = []
    acc[li!.project_id]!.push(li)
    return acc
  }, {})

  const totalProjects = ps.length
  const openQuotes = ps.filter(p => p.status === 'Quote').length
  const awaitingDeposit = ps.filter(p => {
    const s = stagesMap[p.id]
    return s?.quote_sent && !s?.deposit_received
  }).length
  const completedProjects = ps.filter(p => p.status === 'Completed')
  const totalRevenue = completedProjects.reduce((sum, p) => {
    const items = lineItemsByProject[p.id] ?? []
    const totals = computeTotals(items as any, p.design_fee ?? 0)
    return sum + totals.grand_total
  }, 0)

  // Active projects for kanban (not cancelled/completed)
  const activeProjects = ps.filter(p => p.status !== 'Cancelled' && p.status !== 'Completed')

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        actions={
          <Link href="/projects/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2C2C2A] text-[#F5F2EC] text-sm font-medium rounded hover:bg-[#9A7B4F] transition-colors">
            <Plus size={15} /> New Project
          </Link>
        }
      />

      <div className="p-8 space-y-8">
        {/* Stat tiles */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Projects', value: totalProjects, sub: null },
            { label: 'Open Quotes', value: openQuotes, sub: null },
            { label: 'Awaiting Deposit', value: awaitingDeposit, sub: 'quote sent, not paid' },
            { label: 'Total Revenue', value: formatZAR(totalRevenue), sub: `${completedProjects.length} completed` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white border border-[#D8D3C8] rounded p-5">
              <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">{label}</p>
              <p className="font-serif text-3xl text-[#1A1A18] mt-2">{value}</p>
              {sub && <p className="text-xs text-[#8A877F] mt-1">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Kanban */}
        <div>
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-4">Project Pipeline</h2>
          <KanbanBoard
            projects={activeProjects}
            stagesMap={stagesMap}
            stageConfig={STAGE_CONFIG}
          />
        </div>
      </div>
    </div>
  )
}
