'use client'
import { useState } from 'react'
import { CheckCircle2, DollarSign } from 'lucide-react'

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
        isFullyCollected: true,
      }
    }
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
  const outstandingCount = groups.filter(g => !g.isFullyCollected).length

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
    <div className="bg-[#1A1A18] border border-[#C4A46B]/25 rounded-xl overflow-hidden mb-8">
      <div className="px-5 py-4 border-b border-[#C4A46B]/10 flex items-center gap-3">
        <DollarSign size={14} className="text-[#C4A46B]" />
        <h2 className="text-sm font-semibold text-white">1% Fee Collection</h2>
        {outstandingCount > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
            {outstandingCount} supplier{outstandingCount !== 1 ? 's' : ''} owing
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
            All collected
          </span>
        )}
        {apiError && (
          <span className="ml-auto text-xs text-red-400">{apiError}</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Supplier', 'Email', 'Items', 'Fee Owed', ''].map(h => (
                <th key={h} className="px-5 py-2.5 text-left text-xs font-medium text-white/30 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {groups.map(group => {
              const key = group.email || group.name
              return (
                <tr
                  key={key}
                  className={`transition-colors ${group.isFullyCollected ? 'opacity-30' : 'hover:bg-white/[0.03]'}`}
                >
                  <td className="px-5 py-3 text-white font-medium whitespace-nowrap">{group.name}</td>
                  <td className="px-5 py-3 text-white/40 text-xs whitespace-nowrap">{group.email || '—'}</td>
                  <td className="px-5 py-3 text-white/60 text-xs whitespace-nowrap">
                    {group.isFullyCollected
                      ? <span className="text-white/20">—</span>
                      : <>{group.uncollectedIds.length} item{group.uncollectedIds.length !== 1 ? 's' : ''}</>
                    }
                  </td>
                  <td className="px-5 py-3 font-mono font-semibold whitespace-nowrap">
                    {group.isFullyCollected
                      ? <span className="text-white/20">{fmt(group.collectedFee)}</span>
                      : <span className="text-[#C4A46B]">{fmt(group.uncollectedFee)}</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {group.isFullyCollected ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400/70">
                        <CheckCircle2 size={12} /> Collected
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkPaid(group)}
                        disabled={marking === key}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {marking === key ? 'Marking…' : 'Mark Paid'}
                      </button>
                    )}
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
