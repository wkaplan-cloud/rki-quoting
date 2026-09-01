import type { LineItem, LineItemComputed, ProjectTotals } from './types'

// ─── Per-line calculations ────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * The only fields the per-line maths reads. Callers holding a narrower row —
 * the admin dashboard selects five columns, not the whole line item — can pass
 * it directly instead of casting through `any`.
 */
export interface LineItemCalcInput {
  cost_price: number
  markup_percentage: number
  quantity: number
  row_type?: string | null
  sale_price_override?: number | null
}

export function computeLineItem(item: LineItem): LineItemComputed
export function computeLineItem<T extends LineItemCalcInput>(item: T): T & LineItemCalcResult
export function computeLineItem(item: LineItemCalcInput): LineItemCalcInput & LineItemCalcResult {
  const sale_price = r2(item.sale_price_override ?? item.cost_price * (1 + item.markup_percentage / 100))
  const total_cost = item.cost_price * item.quantity
  const total_price = sale_price * item.quantity
  const profit = total_price - total_cost

  return { ...item, sale_price, profit, total_cost, total_price }
}

export interface LineItemCalcResult {
  sale_price: number
  profit: number
  total_cost: number
  total_price: number
}

export function computeLineItems(items: LineItem[]): LineItemComputed[]
export function computeLineItems<T extends LineItemCalcInput>(items: T[]): (T & LineItemCalcResult)[]
export function computeLineItems(items: LineItemCalcInput[]): (LineItemCalcInput & LineItemCalcResult)[] {
  return items.filter(i => i.row_type !== 'section').map(i => computeLineItem(i))
}

// ─── Project totals ───────────────────────────────────────────────────────────

export function computeTotals(
  items: LineItem[],
  design_fee_pct: number,
  vat_rate: number = 15,
  deposit_pct: number = 50
): ProjectTotals {
  const computed = computeLineItems(items)
  const subtotal = computed.reduce((sum, i) => sum + i.total_price, 0)
  const design_fee = subtotal * (design_fee_pct / 100)
  const vat_base = subtotal + design_fee
  const vat_amount = vat_base * (vat_rate / 100)
  const grand_total = vat_base + vat_amount
  const deposit = grand_total * (deposit_pct / 100)
  const balance_due = grand_total - deposit

  return { subtotal, design_fee, vat_base, vat_amount, grand_total, deposit, balance_due }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

//   = non-breaking space — keeps "R" and the number on the same line in narrow PDF columns
export function formatZAR(amount: number): string {
  return 'R ' + amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
