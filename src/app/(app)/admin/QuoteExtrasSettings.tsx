'use client'
import { useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import {
  planProblem, planTotalPct,
  type ExclusionPreset, type PaymentPlanPreset,
} from '@/lib/payment-plan'

// Saved payment plans and "Not included" lists (orgs with payment_plan_enabled).
// A quote picks one of these and can then change it for that quote only.

type StageDraft = { label: string; pct: string }
type PlanDraft = { name: string; stages: StageDraft[] }

const FIELD = 'w-full px-2 py-1.5 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] hover:border-[#B8B2A6] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors'
const LINK = 'inline-flex items-center gap-1 text-xs text-[#9A7B4F] hover:text-[#7E6036] active:text-[#5E4728] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A7B4F] rounded px-1 cursor-pointer'
const REMOVE = 'p-1 text-[#B8B2A6] hover:text-red-500 active:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded cursor-pointer'

const toPlanDrafts = (presets: PaymentPlanPreset[]): PlanDraft[] =>
  presets.map(p => ({ name: p.name, stages: p.stages.map(s => ({ label: s.label, pct: String(s.pct) })) }))

function planIssue(p: PlanDraft): string | null {
  if (!p.name.trim()) return 'Give this plan a name'
  return planProblem(p.stages.map(s => ({ label: s.label.trim(), pct: parseFloat(s.pct) || 0 })))
}

export function QuoteExtrasSettings({ settingsId, initialPlans, initialLists }: {
  settingsId: string
  initialPlans: PaymentPlanPreset[]
  initialLists: ExclusionPreset[]
}) {
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanDraft[]>(toPlanDrafts(initialPlans))
  const [lists, setLists] = useState<ExclusionPreset[]>(initialLists.map(l => ({ name: l.name, lines: l.lines.map(x => ({ ...x })) })))
  const [saving, setSaving] = useState(false)

  const planIssues = plans.map(planIssue)
  const listIssues = lists.map(l => (l.name.trim() ? null : 'Give this list a name'))
  const blocked = [...planIssues, ...listIssues].some(Boolean)

  const editPlan = (i: number, fn: (p: PlanDraft) => PlanDraft) => setPlans(prev => prev.map((p, j) => (j === i ? fn(p) : p)))
  const editList = (i: number, fn: (l: ExclusionPreset) => ExclusionPreset) => setLists(prev => prev.map((l, j) => (j === i ? fn(l) : l)))

  async function save() {
    if (blocked) return
    setSaving(true)
    const payment_plan_presets: PaymentPlanPreset[] = plans.map(p => ({
      name: p.name.trim(),
      stages: p.stages.map(s => ({ label: s.label.trim(), pct: parseFloat(s.pct) || 0 })),
    }))
    const exclusion_presets: ExclusionPreset[] = lists.map(l => ({
      name: l.name.trim(),
      lines: l.lines.map(x => ({ item: x.item.trim(), price: x.price.trim() })).filter(x => x.item),
    }))
    const { error } = await supabase.from('settings').update({ payment_plan_presets, exclusion_presets }).eq('id', settingsId)
    setSaving(false)
    if (error) toast.error('Could not save your plans and lists')
    else toast.success('Payment plans and lists saved')
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Payment plans */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-xs font-medium text-[#8A877F]">Payment Plans</h3>
            <p className="text-xs text-[#A8A39B] max-w-md">
              Save a plan for each kind of job. On a quote, pick one and change it for that quote if needed. Stages must add up to 100%; the first stage is the deposit.
            </p>
          </div>
          <button type="button" onClick={() => setPlans(prev => [{ name: '', stages: [{ label: '', pct: '' }] }, ...prev])} className={`${LINK} whitespace-nowrap`}>
            <Plus size={12} /> Add a plan
          </button>
        </div>

        {plans.map((p, i) => (
          <div key={i} className="border border-[#EDE9E1] rounded p-3 space-y-2 bg-[#FDFCFB]">
            <div className="flex items-center gap-2">
              <input aria-label={`Plan ${i + 1} name`} value={p.name} onChange={e => editPlan(i, x => ({ ...x, name: e.target.value }))} className={`${FIELD} font-medium`} />
              <button type="button" onClick={() => setPlans(prev => prev.filter((_, j) => j !== i))} aria-label={`Delete plan ${p.name || i + 1}`} className={REMOVE}>
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-[1fr_4.5rem_1.75rem] gap-2 text-[11px] text-[#8A877F] uppercase tracking-wider">
              <span>Stage</span><span className="text-right">%</span><span />
            </div>
            {p.stages.map((s, k) => (
              <div key={k} className="grid grid-cols-[1fr_4.5rem_1.75rem] gap-2 items-center">
                <input aria-label={`Plan ${i + 1} stage ${k + 1} name`} value={s.label}
                  onChange={e => editPlan(i, x => ({ ...x, stages: x.stages.map((y, m) => (m === k ? { ...y, label: e.target.value } : y)) }))}
                  className={FIELD} />
                <input aria-label={`Plan ${i + 1} stage ${k + 1} percentage`} type="text" inputMode="decimal" value={s.pct}
                  onChange={e => editPlan(i, x => ({ ...x, stages: x.stages.map((y, m) => (m === k ? { ...y, pct: e.target.value.replace('%', '') } : y)) }))}
                  className={`${FIELD} text-right tabular-nums`} />
                <button type="button" onClick={() => editPlan(i, x => ({ ...x, stages: x.stages.filter((_, m) => m !== k) }))} aria-label={`Remove stage ${k + 1}`} className={REMOVE}>
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => editPlan(i, x => ({ ...x, stages: [...x.stages, { label: '', pct: '' }] }))} className={LINK}>
                <Plus size={12} /> Add stage
              </button>
              {planIssues[i]
                ? <span className="text-amber-700">{planIssues[i]}</span>
                : <span className="text-green-700">{planTotalPct(p.stages.map(s => ({ label: s.label, pct: parseFloat(s.pct) || 0 })))}%</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Not included lists */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="text-xs font-medium text-[#8A877F]">&ldquo;Not Included&rdquo; Lists</h3>
            <p className="text-xs text-[#A8A39B] max-w-md">
              Extras you can add to a quote, e.g. additional renders or travel. They print under the totals with their prices but never add to the total.
            </p>
          </div>
          <button type="button" onClick={() => setLists(prev => [{ name: '', lines: [{ item: '', price: '' }] }, ...prev])} className={`${LINK} whitespace-nowrap`}>
            <Plus size={12} /> Add a list
          </button>
        </div>

        {lists.map((l, i) => (
          <div key={i} className="border border-[#EDE9E1] rounded p-3 space-y-2 bg-[#FDFCFB]">
            <div className="flex items-center gap-2">
              <input aria-label={`List ${i + 1} name`} value={l.name} onChange={e => editList(i, x => ({ ...x, name: e.target.value }))} className={`${FIELD} font-medium`} />
              <button type="button" onClick={() => setLists(prev => prev.filter((_, j) => j !== i))} aria-label={`Delete list ${l.name || i + 1}`} className={REMOVE}>
                <Trash2 size={13} />
              </button>
            </div>
            <div className="grid grid-cols-[1fr_9rem_1.75rem] gap-2 text-[11px] text-[#8A877F] uppercase tracking-wider">
              <span>Not included</span><span>Price</span><span />
            </div>
            {l.lines.map((x, k) => (
              <div key={k} className="grid grid-cols-[1fr_9rem_1.75rem] gap-2 items-center">
                <input aria-label={`List ${i + 1} line ${k + 1}`} value={x.item}
                  onChange={e => editList(i, y => ({ ...y, lines: y.lines.map((z, m) => (m === k ? { ...z, item: e.target.value } : z)) }))}
                  className={FIELD} />
                <input aria-label={`List ${i + 1} line ${k + 1} price`} value={x.price}
                  onChange={e => editList(i, y => ({ ...y, lines: y.lines.map((z, m) => (m === k ? { ...z, price: e.target.value } : z)) }))}
                  className={FIELD} />
                <button type="button" onClick={() => editList(i, y => ({ ...y, lines: y.lines.filter((_, m) => m !== k) }))} aria-label={`Remove line ${k + 1}`} className={REMOVE}>
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => editList(i, y => ({ ...y, lines: [...y.lines, { item: '', price: '' }] }))} className={LINK}>
                <Plus size={12} /> Add line
              </button>
              {listIssues[i] && <span className="text-amber-700">{listIssues[i]}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || blocked}>
          {saving ? 'Saving…' : 'Save plans and lists'}
        </Button>
        {blocked && <span className="text-xs text-amber-700">Fix the notes above to save.</span>}
      </div>
    </div>
  )
}
