'use client'
import { useState } from 'react'
import { CheckCircle2, Circle, TrendingUp, Wallet } from 'lucide-react'

function fmt(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface CollectibleItem {
  id: string
  supplier_name: string
  supplier_email: string
  fee: number
  fee_collected_at: string | null
}

interface SupplierGroup {
  name: string
  email: string
  uncollectedIds: string[]
  uncollectedFee: number
  collectedFee: number
  itemCount: number
  isFullyCollected: boolean
}

function buildGroups(items: CollectibleItem[]): SupplierGroup[] {
  const map: Record<string, SupplierGroup> = {}
  for (const item of items) {
    const key = item.supplier_email || item.supplier_name
    if (!map[key]) {
      map[key] = {
        name: item.supplier_name,
        email: item.supplier_email,
        uncollectedIds: [],
        uncollectedFee: 0,
        collectedFee: 0,
        itemCount: 0,
        isFullyCollected: true,
      }
    }
    map[key].itemCount++
    if (item.fee_collected_at) {
      map[key].collectedFee += item.fee
    } else {
      map[key].uncollectedIds.push(item.id)
      map[key].uncollectedFee += item.fee
      map[key].isFullyCollected = false
    }
  }
  return Object.values(map).sort((a, b) => {
    if (a.isFullyCollected !== b.isFullyCollected) return a.isFullyCollected ? 1 : -1
    return b.uncollectedFee - a.uncollectedFee
  })
}

export function SourcingFeeTracker({ items: initialItems }: { items: CollectibleItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [marking, setMarking] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const groups = buildGroups(items)
  const outstanding = groups.filter(g => !g.isFullyCollected)
  const collected = groups.filter(g => g.isFullyCollected)

  const totalOutstanding = outstanding.reduce((s, g) => s + g.uncollectedFee, 0)
  const totalCollected = items.filter(i => i.fee_collected_at).reduce((s, i) => s + i.fee, 0)

  if (groups.length === 0) return null

  async function handleMarkPaid(group: SupplierGroup) {
    if (group.uncollectedIds.length === 0) return
    const key = group.email || group.name
    setMarking(key)
    setApiError(null)
    try {
      const res = await fetch('/api/platform/fee-collect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentIds: group.uncollectedIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        setApiError(data.error ?? 'Failed to mark as paid')
        return
      }
      const now = new Date().toISOString()
      setItems(prev =>
        prev.map(item =>
          group.uncollectedIds.includes(item.id) ? { ...item, fee_collected_at: now } : item
        )
      )
    } finally {
      setMarking(null)
    }
  }

  return (
    <div className="bg-[#1A1A18] border border-white/8 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="px-6 py-5 border-b border-white/8 flex items-start justify-between gap-6">
        <div>
          <h2 className="text-sm font-semibold text-white">1% Fee Collection</h2>
          <p className="text-xs text-white/35 mt-0.5">Click &ldquo;Mark Paid&rdquo; once you have received payment from a supplier</p>
          {apiError && <p className="text-xs text-red-400 mt-1">{apiError}</p>}
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              <TrendingUp size={11} className="text-amber-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/70">Outstanding</span>
            </div>
            <p className="text-lg font-semibold text-amber-400 tabular-nums">{fmt(totalOutstanding)}</p>
          </div>
          <div className="w-px h-8 bg-white/8" />
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 mb-0.5">
              <Wallet size={11} className="text-emerald-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">Collected</span>
            </div>
            <p className="text-lg font-semibold text-emerald-400 tabular-nums">{fmt(totalCollected)}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-6 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/25">Supplier</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-white/25">Email</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25">Items</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25">Fee Owed</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25">Collected</th>
              <th className="px-6 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-white/25"></th>
            </tr>
          </thead>
          <tbody>
            {/* Outstanding suppliers */}
            {outstanding.map(group => {
              const key = group.email || group.name
              const isMarking = marking === key
              return (
                <tr key={key} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <Circle size={7} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                      <span className="text-white font-medium text-sm">{group.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-white/40 text-xs">{group.email || '—'}</td>
                  <td className="px-4 py-3.5 text-right text-white/50 text-xs tabular-nums">
                    {group.uncollectedIds.length}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-amber-400 font-semibold tabular-nums text-sm">{fmt(group.uncollectedFee)}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-white/20 text-xs tabular-nums">
                    {group.collectedFee > 0 ? fmt(group.collectedFee) : '—'}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <button
                      onClick={() => handleMarkPaid(group)}
                      disabled={isMarking}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 size={12} />
                      {isMarking ? 'Saving…' : 'Mark Paid'}
                    </button>
                  </td>
                </tr>
              )
            })}

            {/* Divider between outstanding and collected */}
            {outstanding.length > 0 && collected.length > 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-2 bg-white/[0.02]">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/15">Collected</span>
                </td>
              </tr>
            )}

            {/* Collected suppliers */}
            {collected.map(group => {
              const key = group.email || group.name
              return (
                <tr key={key} className="border-b border-white/[0.03] opacity-30">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={10} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-white/60 text-sm">{group.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/30 text-xs">{group.email || '—'}</td>
                  <td className="px-4 py-3 text-right text-white/30 text-xs tabular-nums">{group.itemCount}</td>
                  <td className="px-4 py-3 text-right text-white/20 text-xs">—</td>
                  <td className="px-4 py-3 text-right text-white/40 text-xs tabular-nums">{fmt(group.collectedFee)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-xs text-emerald-400/60 flex items-center justify-end gap-1">
                      <CheckCircle2 size={11} /> Collected
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
