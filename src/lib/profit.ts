// Profit on one project, excluding VAT: line profit plus the design fee.
// design_fee is a PERCENTAGE of the items' sale total, not a rand amount.
// Shared by Admin → Profit and the assistant's profit answers so the two
// can never disagree.

import { computeLineItems, type LineItemCalcInput } from './quoting'

export interface ProjectProfit {
  sale: number
  cost: number
  lineProfit: number
  designFee: number
  profit: number
}

export function projectProfit(lines: LineItemCalcInput[], designFeePct: number | null | undefined): ProjectProfit {
  const computed = computeLineItems(lines)
  const sale = computed.reduce((t, i) => t + i.total_price, 0)
  const cost = computed.reduce((t, i) => t + i.total_cost, 0)
  const lineProfit = computed.reduce((t, i) => t + i.profit, 0)
  const designFee = sale * ((designFeePct ?? 0) / 100)
  return { sale, cost, lineProfit, designFee, profit: lineProfit + designFee }
}
