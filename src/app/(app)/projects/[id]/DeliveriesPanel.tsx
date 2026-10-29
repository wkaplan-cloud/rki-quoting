'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, CalendarClock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { todaySA } from '@/lib/dates'
import type { LineItem } from '@/lib/types'
import {
  type SupplierDates, type DeliveryState,
  isDeliveryLine, supplierKey, expectedDate, deliveryState, DELIVERY_STATE_LABEL,
} from '@/lib/deliveries'

const DATE_INPUT = 'px-2 py-1 border border-[#D8D3C8] rounded text-sm outline-none bg-white focus-visible:ring-1 focus-visible:ring-[#9A7B4F] disabled:opacity-60'

export const STATE_BADGE: Record<DeliveryState, string> = {
  received: 'bg-green-50 text-green-700',
  late:     'bg-red-50 text-red-700',
  overdue:  'bg-amber-50 text-amber-800',
  due:      'bg-[#F5F2EC] text-[#6E6B63]',
  undated:  'bg-[#F5F2EC] text-[#A09C93]',
}

interface Props {
  projectId: string
  lineItems: LineItem[]
  onLineItemsChange: (updater: (prev: LineItem[]) => LineItem[]) => void
  initialSupplierDates: SupplierDates
  initialInstallDeadline: string | null
  locked?: boolean
}

/**
 * Delivery dates for one project: a date per supplier, an optional per-item
 * override, and the installation deadline. Only rendered when the org has
 * the delivery timeline feature switched on.
 */
export function DeliveriesPanel({ projectId, lineItems, onLineItemsChange, initialSupplierDates, initialInstallDeadline, locked }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(true)
  const [supplierDates, setSupplierDates] = useState<SupplierDates>(initialSupplierDates)
  const [deadline, setDeadline] = useState(initialInstallDeadline)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const today = todaySA()

  const groups = useMemo(() => {
    const bySupplier = new Map<string, LineItem[]>()
    for (const li of lineItems) {
      if (!isDeliveryLine(li)) continue
      const key = supplierKey(li.supplier_name)
      bySupplier.set(key, [...(bySupplier.get(key) ?? []), li])
    }
    return [...bySupplier.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [lineItems])

  async function saveDeadline(value: string | null) {
    setDeadline(value)
    const { error } = await supabase.from('projects').update({ install_deadline: value }).eq('id', projectId)
    if (error) toast.error('Could not save the installation deadline')
  }

  async function saveSupplierDate(supplier: string, value: string | null) {
    setSupplierDates(prev => ({ ...prev, [supplier]: value }))
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const { error } = await supabase.from('project_supplier_deliveries').upsert(
      { org_id: orgId, project_id: projectId, supplier_name: supplier, delivery_date: value },
      { onConflict: 'project_id,supplier_name' },
    )
    if (error) toast.error(`Could not save the delivery date for ${supplier}`)
  }

  async function saveItemDate(id: string, value: string | null) {
    onLineItemsChange(prev => prev.map(li => li.id === id ? { ...li, delivery_date: value } : li))
    const { error } = await supabase.from('line_items').update({ delivery_date: value }).eq('id', id)
    if (error) toast.error('Could not save the delivery date')
  }

  function toggle(supplier: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(supplier)) next.delete(supplier)
      else next.add(supplier)
      return next
    })
  }

  const lateCount = groups.reduce((n, [, items]) =>
    n + items.filter(li => deliveryState(expectedDate(li, supplierDates), li.received, deadline, today) === 'late').length, 0)

  return (
    <div className="hidden md:block px-8 mt-6 border-t border-[#EDE9E1] pt-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-3 hover:text-[#2C2C2A] focus-visible:text-[#2C2C2A] transition-colors cursor-pointer w-full"
      >
        <CalendarClock size={13} /> Deliveries
        {lateCount > 0 && (
          <span className="ml-1 bg-red-50 text-red-700 rounded-full px-1.5 py-0.5 normal-case tracking-normal font-normal">
            {lateCount} after deadline
          </span>
        )}
        <ChevronDown size={12} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="bg-white border border-[#EDE9E1] rounded">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#EDE9E1]">
            <label htmlFor="install-deadline" className="text-sm text-[#2C2C2A] font-medium">Installation deadline</label>
            <input
              id="install-deadline"
              type="date"
              value={deadline ?? ''}
              disabled={locked}
              onChange={e => saveDeadline(e.target.value || null)}
              className={DATE_INPUT}
            />
            <Link href="/timeline" className="ml-auto text-xs text-[#9A7B4F] hover:text-[#7E6036] hover:underline focus-visible:underline">
              Open timeline →
            </Link>
          </div>

          {groups.length === 0 ? (
            <p className="px-4 py-4 text-sm text-[#8A877F]">Add a supplier to a line item to give it a delivery date.</p>
          ) : groups.map(([supplier, items]) => {
            const isOpen = expanded.has(supplier)
            const supplierDate = supplierDates[supplier] ?? null
            const overrides = items.filter(li => li.delivery_date).length
            return (
              <div key={supplier} className="border-b border-[#F2EFE9] last:border-0">
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    onClick={() => toggle(supplier)}
                    className="flex items-center gap-2 text-sm text-[#2C2C2A] hover:text-[#7E6036] focus-visible:text-[#7E6036] cursor-pointer min-w-0"
                    aria-expanded={isOpen}
                  >
                    <ChevronDown size={13} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    <span className="font-medium truncate">{supplier}</span>
                    <span className="text-xs text-[#8A877F] shrink-0">
                      {items.length} item{items.length === 1 ? '' : 's'}
                      {overrides > 0 && ` · ${overrides} with own date`}
                    </span>
                  </button>
                  <input
                    type="date"
                    aria-label={`Delivery date for ${supplier}`}
                    value={supplierDate ?? ''}
                    disabled={locked}
                    onChange={e => saveSupplierDate(supplier, e.target.value || null)}
                    className={`ml-auto ${DATE_INPUT}`}
                  />
                </div>

                {isOpen && (
                  <ul className="pb-2">
                    {items.map(li => {
                      const date = expectedDate(li, supplierDates)
                      const state = deliveryState(date, li.received, deadline, today)
                      return (
                        <li key={li.id} className="flex items-center gap-3 pl-10 pr-4 py-1.5 text-sm">
                          <span className="text-[#2C2C2A] truncate min-w-0">{li.item_name || 'Untitled item'}</span>
                          <span className={`shrink-0 px-2 py-0.5 rounded text-xs ${STATE_BADGE[state]}`}>{DELIVERY_STATE_LABEL[state]}</span>
                          <span className="ml-auto flex items-center gap-1.5 shrink-0">
                            {!li.delivery_date && supplierDate && (
                              <span className="text-xs text-[#A09C93]">supplier date</span>
                            )}
                            <input
                              type="date"
                              aria-label={`Delivery date for ${li.item_name}`}
                              // Shows the inherited supplier date (greyed) until the item gets its own.
                              value={li.delivery_date ?? supplierDate ?? ''}
                              disabled={locked}
                              onChange={e => saveItemDate(li.id, e.target.value && e.target.value !== supplierDate ? e.target.value : null)}
                              className={`${DATE_INPUT} ${li.delivery_date ? '' : 'text-[#A09C93]'}`}
                            />
                            {li.delivery_date && !locked ? (
                              <button
                                onClick={() => saveItemDate(li.id, null)}
                                title="Use the supplier date again"
                                aria-label="Use the supplier date again"
                                className="p-1 rounded text-[#A09C93] hover:text-[#2C2C2A] hover:bg-[#F5F2EC] focus-visible:text-[#2C2C2A] active:bg-[#EDE9E1] cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            ) : <span className="w-[21px]" />}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
