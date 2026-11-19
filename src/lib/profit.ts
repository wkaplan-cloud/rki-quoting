// Profit on one project, excluding VAT: line profit, less any discount, plus the design fee.
// design_fee is a PERCENTAGE of the items' sale total after discount, not a rand amount.
// Delivery is a pass-through charge and is not counted as profit.
// Shared by Admin → Profit and the assistant's profit answers so the two
// can never disagree.

import { computeLineItems, discountAmount, type LineItemCalcInput, type TotalsAdjustments } from './quoting'

export interface ProjectProfit {
  sale: number
  cost: number
  lineProfit: number
  discount: number
  designFee: number
  profit: number
}

export function projectProfit(lines: LineItemCalcInput[], designFeePct: number | null | undefined, adj?: TotalsAdjustments | null): ProjectProfit {
  const computed = computeLineItems(lines)
  const sale = computed.reduce((t, i) => t + i.total_price, 0)
  const cost = computed.reduce((t, i) => t + i.total_cost, 0)
  const lineProfit = computed.reduce((t, i) => t + i.profit, 0)
  const discount = discountAmount(sale, adj)
  const designFee = (sale - discount) * ((designFeePct ?? 0) / 100)
  return { sale, cost, lineProfit, discount, designFee, profit: lineProfit - discount + designFee }
}
