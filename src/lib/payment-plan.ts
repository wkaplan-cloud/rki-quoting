// Payment plan + "Not included in this quote" (orgs with settings.payment_plan_enabled).
// Settings keep several saved plans/lists; a project copies one in and edits it.

export type PlanStage = { label: string; pct: number }
export type PaymentPlanPreset = { name: string; stages: PlanStage[] }
export type ExclusionLine = { item: string; price: string }
export type ExclusionPreset = { name: string; lines: ExclusionLine[] }

const round2 = (n: number) => Math.round(n * 100) / 100

export function planTotalPct(stages: PlanStage[]): number {
  return round2(stages.reduce((sum, s) => sum + (Number.isFinite(s.pct) ? s.pct : 0), 0))
}

/** Why a plan can't be saved yet, or null when it's fine. */
export function planProblem(stages: PlanStage[]): string | null {
  if (!stages.length) return 'Add at least one stage'
  if (stages.some(s => !s.label.trim())) return 'Every stage needs a name'
  if (stages.some(s => !(s.pct > 0))) return 'Every stage needs a percentage above 0'
  const total = planTotalPct(stages)
  if (total !== 100) return `Adds up to ${total}%, must be 100%`
  return null
}

/** Rand amount per stage. The last stage takes the remainder so the stages add up to the total exactly. */
export function planAmounts(stages: PlanStage[], grandTotal: number): number[] {
  let used = 0
  return stages.map((s, i) => {
    if (i === stages.length - 1) return round2(grandTotal - used)
    const amount = round2(grandTotal * (s.pct / 100))
    used += amount
    return amount
  })
}

/** Only well-formed stages; null when there's no usable plan. */
export function cleanPlan(raw: unknown): PlanStage[] | null {
  if (!Array.isArray(raw)) return null
  const stages = raw
    .filter((s): s is PlanStage => !!s && typeof s.label === 'string' && typeof s.pct === 'number')
    .map(s => ({ label: s.label.trim(), pct: s.pct }))
  return stages.length && !planProblem(stages) ? stages : null
}

/** Lines with an item name; null when there are none. */
export function cleanExclusions(raw: unknown): ExclusionLine[] | null {
  if (!Array.isArray(raw)) return null
  const lines = raw
    .filter((l): l is ExclusionLine => !!l && typeof l.item === 'string')
    .map(l => ({ item: l.item.trim(), price: typeof l.price === 'string' ? l.price.trim() : '' }))
    .filter(l => l.item)
  return lines.length ? lines : null
}
