'use client'
import { useState } from 'react'
import { Plus, X, ListOrdered, CircleSlash } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { formatZAR } from '@/lib/quoting'
import {
  cleanExclusions, planAmounts, planProblem, planTotalPct,
  type ExclusionLine, type ExclusionPreset, type PaymentPlanPreset, type PlanStage,
} from '@/lib/payment-plan'

// Payment plan + "Not included in this quote" for one project (orgs with
// settings.payment_plan_enabled). Each starts empty; pick one of the studio's
// saved plans/lists from Settings, then change it for this quote.

type StageDraft = { label: string; pct: string }

const toDrafts = (stages: PlanStage[] | null | undefined): StageDraft[] =>
  (stages ?? []).map(s => ({ label: s.label, pct: String(s.pct) }))
const fromDrafts = (rows: StageDraft[]): PlanStage[] =>
  rows.map(r => ({ label: r.label.trim(), pct: parseFloat(r.pct) || 0 }))

const FIELD = 'w-full px-2 py-1.5 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] hover:border-[#B8B2A6] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors disabled:opacity-50'
const PICK = 'px-2 py-1 bg-white border border-[#D8D3C8] rounded text-xs text-[#2C2C2A] hover:border-[#9A7B4F] focus-visible:border-[#9A7B4F] focus-visible:ring-1 focus-visible:ring-[#9A7B4F] outline-none cursor-pointer disabled:opacity-50'
const LINK = 'inline-flex items-center gap-1 text-xs text-[#9A7B4F] hover:text-[#7E6036] active:text-[#5E4728] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F] rounded px-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
const REMOVE = 'p-1 text-[#B8B2A6] hover:text-red-500 active:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded cursor-pointer disabled:opacity-50'

export function QuoteExtrasPanel({
  projectId, initialPlan, initialExclusions, planPresets, exclusionPresets, grandTotal, depositPct, locked, onPlanSaved,
}: {
  projectId: string
  initialPlan: PlanStage[] | null
  initialExclusions: ExclusionLine[] | null
  planPresets: PaymentPlanPreset[]
  exclusionPresets: ExclusionPreset[]
  grandTotal: number
  depositPct: number
  locked: boolean
  /** Saved plan (or null when removed). The first stage becomes the deposit. */
  onPlanSaved: (stages: PlanStage[] | null) => void
}) {
  const supabase = createClient()
  const [stages, setStages] = useState<StageDraft[]>(toDrafts(initialPlan))
  const [lines, setLines] = useState<ExclusionLine[]>(initialExclusions ?? [])

  const parsed = fromDrafts(stages)
  const problem = stages.length ? planProblem(parsed) : null
  const amounts = !problem && stages.length ? planAmounts(parsed, grandTotal) : null

  async function savePlan(rows: StageDraft[]) {
    if (!rows.length) {
      const { error } = await supabase.from('projects').update({ payment_plan: null }).eq('id', projectId)
      if (error) { toast.error('Could not remove the payment plan'); return }
      onPlanSaved(null)
      return
    }
    const next = fromDrafts(rows)
    if (planProblem(next)) return // shown under the plan; saved once it adds up
    const { error } = await supabase.from('projects')
      .update({ payment_plan: next, deposit_percentage: next[0].pct })
      .eq('id', projectId)
    if (error) { toast.error('Could not save the payment plan'); return }
    onPlanSaved(next)
  }

  async function saveLines(rows: ExclusionLine[]) {
    const { error } = await supabase.from('projects').update({ exclusions: cleanExclusions(rows) }).eq('id', projectId)
    if (error) toast.error('Could not save the "Not included" list')
  }

  function editStage(i: number, patch: Partial<StageDraft>) {
    setStages(prev => prev.map((r, j) => j === i ? { ...r, ...patch } : r))
  }
  function removeStage(i: number) {
    const next = stages.filter((_, j) => j !== i)
    setStages(next)
    void savePlan(next)
  }
  function loadPlan(index: string) {
    const preset = planPresets[Number(index)]
    if (!preset) return
    const next = toDrafts(preset.stages)
    setStages(next)
    void savePlan(next)
  }

  function editLine(i: number, patch: Partial<ExclusionLine>) {
    setLines(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l))
  }
  function removeLine(i: number) {
    const next = lines.filter((_, j) => j !== i)
    setLines(next)
    void saveLines(next)
  }
  function loadLines(index: string) {
    const preset = exclusionPresets[Number(index)]
    if (!preset) return
    const next = preset.lines.map(l => ({ ...l }))
    setLines(next)
    void saveLines(next)
  }

  return (
    <div className="hidden md:grid grid-cols-2 gap-6 px-8 mt-6 border-t border-[#EDE9E1] pt-6">
      {/* Payment plan */}
      <section aria-labelledby="payment-plan-heading">
        <div className="flex items-center gap-3 mb-3">
          <h2 id="payment-plan-heading" className="flex items-center gap-2 text-xs font-medium text-[#8A877F] uppercase tracking-wider">
            <ListOrdered size={13} /> Payment plan
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {planPresets.length > 0 && (
              <select aria-label="Use a saved payment plan" value="" onChange={e => loadPlan(e.target.value)} disabled={locked} className={PICK}>
                <option value="">Use a saved plan…</option>
                {planPresets.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => setStages(prev => [...prev, { label: '', pct: '' }])} disabled={locked} className={LINK}>
              <Plus size={12} /> Add stage
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#EDE9E1] rounded p-4">
          {stages.length === 0 ? (
            <p className="text-sm text-[#8A877F]">
              No plan on this quote. It shows the single {depositPct}% deposit.
              {planPresets.length === 0 && ' Save your usual plans under Settings → Quote Defaults.'}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_4.5rem_7rem_1.75rem] gap-2 text-[11px] text-[#8A877F] uppercase tracking-wider mb-1.5">
                <span>Stage</span><span className="text-right">%</span><span className="text-right">Amount</span><span />
              </div>
              <div className="space-y-1.5">
                {stages.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_4.5rem_7rem_1.75rem] gap-2 items-center">
                    <input
                      aria-label={`Stage ${i + 1} name`}
                      value={s.label}
                      onChange={e => editStage(i, { label: e.target.value })}
                      onBlur={() => void savePlan(stages)}
                      disabled={locked}
                      className={FIELD}
                    />
                    <input
                      aria-label={`Stage ${i + 1} percentage`}
                      type="text" inputMode="decimal"
                      value={s.pct}
                      onChange={e => editStage(i, { pct: e.target.value.replace('%', '') })}
                      onBlur={() => void savePlan(stages)}
                      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      disabled={locked}
                      className={`${FIELD} text-right tabular-nums`}
                    />
                    <span className="text-right text-sm tabular-nums text-[#2C2C2A]">{amounts ? formatZAR(amounts[i]) : '–'}</span>
                    <button type="button" onClick={() => removeStage(i)} disabled={locked} aria-label={`Remove stage ${i + 1}`} className={REMOVE}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#EDE9E1] text-xs">
                {problem ? (
                  <span className="text-amber-700">{problem}. Not saved yet.</span>
                ) : (
                  <span className="text-green-700">{planTotalPct(parsed)}% · first stage is the deposit</span>
                )}
                <button type="button" onClick={() => { setStages([]); void savePlan([]) }} disabled={locked} className={LINK}>
                  <CircleSlash size={12} /> No plan
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Not included in this quote */}
      <section aria-labelledby="not-included-heading">
        <div className="flex items-center gap-3 mb-3">
          <h2 id="not-included-heading" className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Not included in this quote</h2>
          <div className="ml-auto flex items-center gap-2">
            {exclusionPresets.length > 0 && (
              <select aria-label="Use a saved Not included list" value="" onChange={e => loadLines(e.target.value)} disabled={locked} className={PICK}>
                <option value="">Use a saved list…</option>
                {exclusionPresets.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
              </select>
            )}
            <button type="button" onClick={() => setLines(prev => [...prev, { item: '', price: '' }])} disabled={locked} className={LINK}>
              <Plus size={12} /> Add line
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#EDE9E1] rounded p-4">
          {lines.length === 0 ? (
            <p className="text-sm text-[#8A877F]">Nothing listed. The quote won&apos;t show this section.</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_9rem_1.75rem] gap-2 text-[11px] text-[#8A877F] uppercase tracking-wider mb-1.5">
                <span>Not included</span><span>Price (not added to total)</span><span />
              </div>
              <div className="space-y-1.5">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_9rem_1.75rem] gap-2 items-center">
                    <input
                      aria-label={`Not included line ${i + 1}`}
                      value={l.item}
                      onChange={e => editLine(i, { item: e.target.value })}
                      onBlur={() => void saveLines(lines)}
                      disabled={locked}
                      className={FIELD}
                    />
                    <input
                      aria-label={`Price for line ${i + 1}`}
                      value={l.price}
                      onChange={e => editLine(i, { price: e.target.value })}
                      onBlur={() => void saveLines(lines)}
                      disabled={locked}
                      className={FIELD}
                    />
                    <button type="button" onClick={() => removeLine(i)} disabled={locked} aria-label={`Remove line ${i + 1}`} className={REMOVE}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
