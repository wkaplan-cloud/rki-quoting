import type { LineItem, LineItemComputed, ProjectTotals } from './types'

// ─── Per-line calculations ────────────────────────────────────────────────────

export function computeLineItem(item: LineItem): LineItemComputed {
  const sale_price = item.cost_price * (1 + item.markup_percentage / 100)
  const total_cost = (item.cost_price * item.quantity) + item.delivery
  const total_price = sale_price * item.quantity
  const profit = total_price - total_cost

  return { ...item, sale_price, profit, total_cost, total_price }
}

export function computeLineItems(items: LineItem[]): LineItemComputed[] {
  return items.filter(i => i.row_type !== 'section').map(computeLineItem)
}

// ─── Project totals ───────────────────────────────────────────────────────────

export function computeTotals(
  items: LineItem[],
  design_fee: number
): ProjectTotals {
  const computed = computeLineItems(items)
  const subtotal = computed.reduce((sum, i) => sum + i.total_price, 0)
  const vat_base = subtotal + design_fee
  const vat_amount = vat_base * 0.15
  const grand_total = subtotal + design_fee + vat_amount
  const deposit_70 = grand_total * 0.7
  const balance_due = grand_total - deposit_70

  return { subtotal, design_fee, vat_base, vat_amount, grand_total, deposit_70, balance_due }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
