export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { fetchAllRows } from '@/lib/fetch-all-rows'
import { todaySA } from '@/lib/dates'
import { isDeliveryLine, supplierKey, expectedDate, deliveryState, type SupplierDates } from '@/lib/deliveries'
import { TimelineView, type TimelineRow, type TimelineProject } from './TimelineView'

// Projects past the quote stage are where things are actually on order.
const ORDERING_STATUSES = new Set(['Approved', 'Deposit', 'Invoice', 'Paid'])

type ProjectRow = {
  id: string
  project_number: string
  project_name: string
  status: string
  install_deadline: string | null
  client: { client_name: string } | { client_name: string }[] | null
}

type LineRow = {
  id: string
  project_id: string
  item_name: string
  supplier_name: string | null
  delivery_date: string | null
  received: boolean
  row_type: 'item' | 'section'
}

export default async function TimelinePage() {
  const supabase = await createClient()

  const { data: settings } = await supabase.from('settings').select('delivery_timeline_enabled').maybeSingle()
  if (!settings?.delivery_timeline_enabled) redirect('/projects')

  const { data: projectData } = await supabase
    .from('projects')
    .select('id, project_number, project_name, status, install_deadline, client:clients(client_name)')
    .is('archived_at', null)
    .not('status', 'in', '("Cancelled","Completed")')
  const allProjects = (projectData ?? []) as ProjectRow[]
  const ids = allProjects.map(p => p.id)

  const [lines, { data: supplierRows }] = await Promise.all([
    ids.length
      ? fetchAllRows<LineRow>((from, to) => supabase
          .from('line_items')
          .select('id, project_id, item_name, supplier_name, delivery_date, received, row_type')
          .in('project_id', ids)
          .order('sort_order')
          .order('id')
          .range(from, to))
      : Promise.resolve({ rows: [] as LineRow[], error: null, truncated: false }),
    ids.length
      ? supabase.from('project_supplier_deliveries').select('project_id, supplier_name, delivery_date').in('project_id', ids)
      : Promise.resolve({ data: [] as { project_id: string; supplier_name: string; delivery_date: string | null }[] }),
  ])

  const datesByProject = new Map<string, SupplierDates>()
  for (const d of supplierRows ?? []) {
    datesByProject.set(d.project_id, { ...(datesByProject.get(d.project_id) ?? {}), [d.supplier_name]: d.delivery_date })
  }

  const today = todaySA()
  const projectById = new Map(allProjects.map(p => [p.id, p]))
  const rowsByProject = new Map<string, TimelineRow[]>()

  for (const li of lines.rows) {
    if (!isDeliveryLine(li)) continue
    const project = projectById.get(li.project_id)
    if (!project) continue
    const date = expectedDate(li, datesByProject.get(li.project_id) ?? {})
    const row: TimelineRow = {
      id: li.id,
      projectId: li.project_id,
      supplier: supplierKey(li.supplier_name),
      item: li.item_name || 'Untitled item',
      date,
      ownDate: !!li.delivery_date,
      state: deliveryState(date, li.received, project.install_deadline, today),
    }
    rowsByProject.set(li.project_id, [...(rowsByProject.get(li.project_id) ?? []), row])
  }

  // Quote-stage projects only appear once someone starts giving them dates.
  const projects: TimelineProject[] = allProjects
    .filter(p => {
      const rows = rowsByProject.get(p.id) ?? []
      if (rows.length === 0) return false
      return ORDERING_STATUSES.has(p.status) || !!p.install_deadline || rows.some(r => r.date)
    })
    .map(p => {
      const client = Array.isArray(p.client) ? p.client[0] : p.client
      return {
        id: p.id,
        label: `${p.project_number} · ${p.project_name}`,
        client: client?.client_name ?? null,
        installDeadline: p.install_deadline,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  const rows = projects.flatMap(p => rowsByProject.get(p.id) ?? [])

  return (
    <div>
      <PageHeader title="Timeline" subtitle="Every delivery across your projects, against each installation deadline" />
      {lines.truncated && (
        <p className="mx-4 md:mx-8 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          Some line items could not be loaded, so this timeline may be incomplete. Refresh to try again.
        </p>
      )}
      <TimelineView projects={projects} rows={rows} today={today} />
    </div>
  )
}
