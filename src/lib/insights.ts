// Admin → Insights: a read-only profit report plus the data clean-up list that
// decides whether the report can be trusted. Per-org feature behind
// settings.insights_enabled. Nothing here writes to project data.
//
// Scope is accepted work: projects Paid in Full, or Approved / Deposit /
// Invoice / Completed. Drafts, Quotes, Cancelled and archived projects are out.

import { computeLineItem, type LineItemCalcInput } from './quoting'

export const MIN_PAID_PROJECTS = 10

const ACCEPTED_STATUSES = new Set(['Approved', 'Deposit', 'Invoice', 'Completed', 'Paid'])

export interface InsightsProject {
  id: string
  project_name: string
  status: string
  design_fee: number | null
  vat_rate: number | null
  client_id: string | null
  client_name: string | null
  paid: boolean
  final_invoice_sent: boolean
  final_invoice_sent_at: string | null
}

export interface InsightsLineItem extends LineItemCalcInput {
  project_id: string
  item_name: string | null
  supplier_name: string | null
  // Always selected, so never undefined (unlike the shared calc input)
  row_type: string | null
  sale_price_override: number | null
}

export interface InsightsClient {
  id: string
  client_name: string | null
  company: string | null
}

interface ProjectRef { id: string; name: string }

export interface Insights {
  paidProjectCount: number
  acceptedProjectCount: number
  totals: { sales: number; itemProfit: number; designFees: number; profit: number; feeShare: number; itemMargin: number }
  noFeeProjects: ProjectRef[]
  clients: { id: string | null; name: string; projects: number; sales: number; profit: number; share: number; margin: number }[]
  top3ClientShare: number
  thinMargin: { atCostLines: number; atCostSales: number; under10Lines: number; under10Sales: number; shareOfSales: number }
  suppliers: { name: string; lines: number; sales: number; profit: number; margin: number }[]
  bestMarginSuppliers: { name: string; lines: number; sales: number; profit: number; margin: number }[]
  busyLowMarginSuppliers: { name: string; lines: number; sales: number; profit: number; margin: number }[]
  topItems: { item: string; supplier: string | null; project: ProjectRef; profit: number; margin: number }[]
  cleanup: {
    completedUnpaid: { project: ProjectRef; client: string | null; totalInclVat: number; invoiceSentAt: string | null; invoiceSent: boolean }[]
    zeroCost: { project: ProjectRef; lines: number; sales: number }[]
    belowCost: { project: ProjectRef; item: string; loss: number }[]
    duplicateClients: { id: string; name: string }[][]
  }
}

// ─── Duplicate-client matching ────────────────────────────────────────────────

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'the'])
// Words too common in business names to mean two clients are the same
const STOP_TOKENS = new Set([
  'interior', 'interiors', 'design', 'designs', 'group', 'hotel', 'hotels', 'studio', 'homes',
  'house', 'property', 'properties', 'trust', 'holdings', 'projects', 'family', 'company',
])

function normaliseTokens(...names: (string | null)[]): string[] {
  return names
    .join(' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    // "Mohammed" and "Mohamed" should meet: collapse doubled letters
    .map(t => t.replace(/(.)\1+/g, '$1'))
    .filter(t => t.length > 0 && !TITLES.has(t))
}

function findDuplicateClients(clients: InsightsClient[]): { id: string; name: string }[][] {
  const parent = new Map(clients.map(c => [c.id, c.id]))
  const find = (id: string): string => {
    const p = parent.get(id)!
    if (p === id) return id
    const root = find(p)
    parent.set(id, root)
    return root
  }
  const union = (a: string, b: string) => parent.set(find(a), find(b))

  const keyed = clients.map(c => {
    const nameTokens = normaliseTokens(c.client_name)
    return {
      id: c.id,
      full: nameTokens.join(' '),
      distinctive: new Set(normaliseTokens(c.client_name, c.company).filter(t => t.length >= 5 && !STOP_TOKENS.has(t))),
    }
  })

  for (let i = 0; i < keyed.length; i++) {
    for (let j = i + 1; j < keyed.length; j++) {
      const a = keyed[i]!, b = keyed[j]!
      const sameName = a.full.length >= 4 && b.full.length >= 4 && (a.full === b.full || a.full.includes(b.full) || b.full.includes(a.full))
      const sharedWord = [...a.distinctive].some(t => b.distinctive.has(t))
      if (sameName || sharedWord) union(a.id, b.id)
    }
  }

  const groups = new Map<string, { id: string; name: string }[]>()
  for (const c of clients) {
    const root = find(c.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push({ id: c.id, name: c.client_name?.trim() || '(no name)' })
  }
  return [...groups.values()].filter(g => g.length > 1)
}

// ─── Report ───────────────────────────────────────────────────────────────────

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)

export function computeInsights(projects: InsightsProject[], lineItems: InsightsLineItem[], clients: InsightsClient[]): Insights {
  const accepted = projects.filter(p => p.paid || ACCEPTED_STATUSES.has(p.status))
  const acceptedById = new Map(accepted.map(p => [p.id, p]))
  const ref = (p: InsightsProject): ProjectRef => ({ id: p.id, name: p.project_name })

  const lines = lineItems
    .filter(li => li.row_type !== 'section' && acceptedById.has(li.project_id))
    .map(li => {
      const c = computeLineItem(li)
      return { ...li, sale: c.sale_price, sales: c.total_price, cost: c.total_cost, profit: c.profit }
    })

  // Per-project sums
  const perProject = new Map<string, { sales: number; profit: number }>()
  for (const l of lines) {
    const t = perProject.get(l.project_id) ?? { sales: 0, profit: 0 }
    t.sales += l.sales
    t.profit += l.profit
    perProject.set(l.project_id, t)
  }
  const projectFee = (p: InsightsProject) => (perProject.get(p.id)?.sales ?? 0) * ((p.design_fee ?? 0) / 100)

  const sales = lines.reduce((s, l) => s + l.sales, 0)
  const itemProfit = lines.reduce((s, l) => s + l.profit, 0)
  const designFees = accepted.reduce((s, p) => s + projectFee(p), 0)
  const profit = itemProfit + designFees

  // Clients
  const byClient = new Map<string, { id: string | null; name: string; projects: number; sales: number; profit: number }>()
  for (const p of accepted) {
    const key = p.client_id ?? 'none'
    const t = byClient.get(key) ?? { id: p.client_id, name: p.client_name?.trim() || 'No client', projects: 0, sales: 0, profit: 0 }
    const pp = perProject.get(p.id) ?? { sales: 0, profit: 0 }
    t.projects += 1
    t.sales += pp.sales
    t.profit += pp.profit + projectFee(p)
    byClient.set(key, t)
  }
  const clientRows = [...byClient.values()]
    .map(c => ({ ...c, share: pct(c.profit, profit), margin: pct(c.profit, c.sales) }))
    .sort((a, b) => b.profit - a.profit)

  // Thin margins: sold at cost, or profit under 10% of the sale price
  const priced = lines.filter(l => l.cost > 0)
  // Sale is rounded to cents, cost may not be — within half a cent counts as at cost
  const isAtCost = (l: { sale: number; cost_price: number }) => Math.abs(l.sale - l.cost_price) < 0.005
  const atCost = priced.filter(isAtCost)
  const under10 = priced.filter(l => !isAtCost(l) && l.sale > l.cost_price && pct(l.sale - l.cost_price, l.sale) < 10)
  const atCostSales = atCost.reduce((s, l) => s + l.sales, 0)
  const under10Sales = under10.reduce((s, l) => s + l.sales, 0)

  // Suppliers, keyed case-insensitively on the name typed on the line
  const bySupplier = new Map<string, { name: string; lines: number; sales: number; profit: number }>()
  for (const l of lines) {
    const name = l.supplier_name?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    const t = bySupplier.get(key) ?? { name, lines: 0, sales: 0, profit: 0 }
    t.lines += 1
    t.sales += l.sales
    t.profit += l.profit
    bySupplier.set(key, t)
  }
  const supplierRows = [...bySupplier.values()].map(s => ({ ...s, margin: pct(s.profit, s.sales) }))

  const topItems = [...lines]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5)
    .map(l => ({
      item: l.item_name?.trim() || '(unnamed item)',
      supplier: l.supplier_name,
      project: ref(acceptedById.get(l.project_id)!),
      profit: l.profit,
      margin: pct(l.sale - l.cost_price, l.sale),
    }))

  // ─── Clean-up ───
  const completedUnpaid = accepted
    .filter(p => p.status === 'Completed' && !p.paid)
    .map(p => {
      const exVat = (perProject.get(p.id)?.sales ?? 0) + projectFee(p)
      return {
        project: ref(p),
        client: p.client_name,
        totalInclVat: exVat * (1 + (p.vat_rate ?? 15) / 100),
        invoiceSent: p.final_invoice_sent,
        invoiceSentAt: p.final_invoice_sent_at,
      }
    })

  const zeroCostByProject = new Map<string, { lines: number; sales: number }>()
  for (const l of lines.filter(l => l.cost_price === 0 && l.sale > 0)) {
    const t = zeroCostByProject.get(l.project_id) ?? { lines: 0, sales: 0 }
    t.lines += 1
    t.sales += l.sales
    zeroCostByProject.set(l.project_id, t)
  }

  const acceptedClientIds = new Set(accepted.map(p => p.client_id).filter(Boolean))

  return {
    paidProjectCount: accepted.filter(p => p.paid).length,
    acceptedProjectCount: accepted.length,
    totals: { sales, itemProfit, designFees, profit, feeShare: pct(designFees, profit), itemMargin: pct(itemProfit, sales) },
    noFeeProjects: accepted.filter(p => !p.design_fee).map(ref),
    clients: clientRows.slice(0, 5),
    top3ClientShare: clientRows.slice(0, 3).reduce((s, c) => s + c.share, 0),
    thinMargin: {
      atCostLines: atCost.length, atCostSales,
      under10Lines: under10.length, under10Sales,
      shareOfSales: pct(atCostSales + under10Sales, sales),
    },
    suppliers: [...supplierRows].sort((a, b) => b.profit - a.profit).slice(0, 5),
    // Margin rankings ignore tiny suppliers, where one line skews the percentage
    bestMarginSuppliers: supplierRows.filter(s => s.sales >= 20000).sort((a, b) => b.margin - a.margin).slice(0, 5),
    busyLowMarginSuppliers: supplierRows.filter(s => s.lines >= 10 && s.margin < 15).sort((a, b) => b.sales - a.sales).slice(0, 5),
    topItems,
    cleanup: {
      completedUnpaid,
      zeroCost: [...zeroCostByProject.entries()].map(([id, t]) => ({ project: ref(acceptedById.get(id)!), ...t })),
      belowCost: lines.filter(l => l.sale < l.cost_price - 0.005).map(l => ({
        project: ref(acceptedById.get(l.project_id)!),
        item: l.item_name?.trim() || '(unnamed item)',
        loss: l.cost - l.sales,
      })),
      duplicateClients: findDuplicateClients(clients.filter(c => acceptedClientIds.has(c.id))),
    },
  }
}
