export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatZAR, computeTotals } from '@/lib/quoting'
import { STAGE_CONFIG } from '@/lib/types'
import { KanbanBoard } from './KanbanBoard'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  const [{ data: projects }, { data: allLineItems }, { data: stages }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(client_name)').order('created_at', { ascending: false }),
    supabase.from('line_items').select('project_id, cost_price, markup_percentage, quantity, row_type'),
    supabaseAdmin.from('project_stages').select('*').in('project_id',
      (await supabase.from('projects').select('id')).data?.map(p => p.id) ?? []
    ),
  ])

  const ps = projects ?? []
  const stagesMap = Object.fromEntries((stages ?? []).map(s => [s.project_id, s]))

  const lineItemsByProject = (allLineItems ?? []).reduce<Record<string, typeof allLineItems>>((acc, li) => {
    if (!acc[li!.project_id]) acc[li!.project_id] = []
    acc[li!.project_id]!.push(li)
    return acc
  }, {})

  // Summary metrics
  const activeProjects = ps.filter(p => p.status !== 'Cancelled' && p.status !== 'Completed')
  const completedProjects = ps.filter(p => p.status === 'Completed')
  const drafts = ps.filter(p => p.status === 'Draft').length
  const openQuotes = ps.filter(p => p.status === 'Quote').length
  const activeInvoices = ps.filter(p => p.status === 'Invoice').length

  const awaitingDeposit = ps.filter(p => {
    const s = stagesMap[p.id]
    return s?.quote_sent && !s?.deposit_received && p.status !== 'Cancelled' && p.status !== 'Completed'
  }).length

  const invoicesOutstanding = ps.filter(p => {
    const s = stagesMap[p.id]
    return s?.final_invoice_sent && !s?.final_invoice_paid && p.status !== 'Cancelled'
  }).length

  const inProduction = ps.filter(p => {
    const s = stagesMap[p.id]
    return s?.deposit_received && !s?.delivered_installed && p.status !== 'Cancelled' && p.status !== 'Completed'
  }).length

  const totalRevenue = completedProjects.reduce((sum, p) => {
    const items = lineItemsByProject[p.id] ?? []
    const totals = computeTotals(items as any, p.design_fee ?? 0)
    return sum + totals.grand_total
  }, 0)

  const activeRevenuePipeline = activeProjects.reduce((sum, p) => {
    const items = lineItemsByProject[p.id] ?? []
    const totals = computeTotals(items as any, p.design_fee ?? 0)
    return sum + totals.grand_total
  }, 0)

  const summaryCards = [
    { label: 'Active Projects', value: activeProjects.length.toString(), sub: `${drafts} drafts · ${openQuotes} quotes · ${activeInvoices} invoices`, alert: false },
    { label: 'Pipeline Value', value: formatZAR(activeRevenuePipeline), sub: 'active projects', alert: false },
    { label: 'Awaiting Deposit', value: awaitingDeposit.toString(), sub: 'quote sent, not paid', alert: awaitingDeposit > 0 },
    { label: 'In Production', value: inProduction.toString(), sub: 'deposit received', alert: false },
    { label: 'Invoices Outstanding', value: invoicesOutstanding.toString(), sub: 'final invoice sent', alert: invoicesOutstanding > 0 },
    { label: 'Total Revenue', value: formatZAR(totalRevenue), sub: `${completedProjects.length} completed projects`, alert: false },
  ]

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
        {/* Summary cards */}
        <div>
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3">Overview</h2>
          <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
            {summaryCards.map(({ label, value, sub, alert }) => (
              <div key={label} className={`bg-white border rounded p-4 ${alert ? 'border-[#9A7B4F]/50 bg-[#9A7B4F]/5' : 'border-[#D8D3C8]'}`}>
                <p className="text-xs font-medium text-[#8A877F] uppercase tracking-wider leading-tight">{label}</p>
                <p className={`font-serif mt-2 leading-tight break-all ${alert ? 'text-[#9A7B4F]' : 'text-[#1A1A18]'} ${value.length > 10 ? 'text-lg' : 'text-2xl'}`}>{value}</p>
                {sub && <p className="text-xs text-[#8A877F] mt-1">{sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline list */}
        <div>
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3">Project Pipeline</h2>
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
