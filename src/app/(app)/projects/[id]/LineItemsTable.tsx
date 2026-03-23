'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeLineItem, formatZAR } from '@/lib/quoting'
import type { LineItem } from '@/lib/types'
import { Plus, Trash2, GripVertical, CornerDownRight, LayoutList } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import toast from 'react-hot-toast'

function CurrencyInput({ value, onChange, onBlur, className }: { value: number; onChange: (v: number) => void; onBlur: (v: number) => void; className: string }) {
  const [focused, setFocused] = useState(false)
  if (focused) return (
    <input
      type="number" min="0" step="0.01" autoFocus
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      onBlur={e => { setFocused(false); onBlur(parseFloat(e.target.value) || 0) }}
      className={className}
    />
  )
  return (
    <button onClick={() => setFocused(true)} className="w-full text-right text-sm tabular-nums text-[#2C2C2A] whitespace-nowrap cursor-text">
      {formatZAR(value)}
    </button>
  )
}

interface Props {
  projectId: string
  lineItems: LineItem[]
  suppliers: { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null }[]
  items: { id: string; item_name: string }[]
  officeAddress: { name: string; address: string }
  onChange: (items: LineItem[]) => void
}

const COL = 'px-2 py-1.5 border-r border-[#EDE9E1] last:border-0'
const INPUT = 'w-full bg-transparent outline-none text-sm text-[#2C2C2A] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 transition-colors placeholder-[#C4BFB5]'
const NUM_INPUT = INPUT + ' text-right tabular-nums'

function AutoTextarea({ value, onChange, onBlur, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  onBlur: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  useEffect(() => { resize() }, [value, resize])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={e => { onChange(e.target.value); resize() }}
      onBlur={e => onBlur(e.target.value)}
      placeholder={placeholder}
      className={className + ' resize-none overflow-hidden leading-snug'}
      style={{ minHeight: '26px' }}
    />
  )
}

export function LineItemsTable({ projectId, lineItems, suppliers, items, officeAddress, onChange }: Props) {
  const supabase = createClient()
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  const updateLocal = useCallback((id: string, field: string, value: string | number) => {
    onChange(lineItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }, [lineItems, onChange])

  const saveField = useCallback(async (id: string, field: string, value: string | number) => {
    await supabase.from('line_items').update({ [field]: value }).eq('id', id)
  }, [supabase])

  const handleSupplierChange = useCallback(async (lineItemId: string, supplierId: string, supplierName: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    const updates: Partial<LineItem> = {
      supplier_id: supplierId || null,
      supplier_name: supplierName || null,
    }
    if (supplier) updates.markup_percentage = supplier.markup_percentage
    onChange(lineItems.map(item => item.id === lineItemId ? { ...item, ...updates } : item))
    await supabase.from('line_items').update(updates).eq('id', lineItemId)
  }, [lineItems, suppliers, onChange, supabase])

  const createSupplier = useCallback(async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const { data, error } = await supabase.from('suppliers').insert({
      user_id: user!.id,
      org_id: orgId,
      supplier_name: name,
      markup_percentage: 0,
    }).select().single()
    if (error) { toast.error('Failed to create supplier'); return { id: '' } }
    toast.success(`Supplier "${name}" created`)
    return { id: data.id }
  }, [supabase])

  const addRow = useCallback(async () => {
    const sort_order = lineItems.length
    const { data, error } = await supabase.from('line_items').insert({
      project_id: projectId,
      item_name: '',
      description: '',
      quantity: 1,
      cost_price: 0,
      markup_percentage: 40,
      delivery_address: officeAddress.address || null,
      sort_order,
      row_type: 'item',
      indent_level: 0,
    }).select().single()
    if (error) { toast.error('Failed to add row'); return }
    onChange([...lineItems, data])
  }, [projectId, lineItems, onChange, supabase])

  const addSection = useCallback(async () => {
    const sort_order = lineItems.length
    const { data, error } = await supabase.from('line_items').insert({
      project_id: projectId,
      item_name: '',
      description: '',
      quantity: 0,
      cost_price: 0,
      markup_percentage: 0,
      sort_order,
      row_type: 'section',
      indent_level: 0,
    }).select().single()
    if (error) { toast.error('Failed to add section'); return }
    onChange([...lineItems, data])
  }, [projectId, lineItems, onChange, supabase])

  const toggleIndent = useCallback(async (id: string, currentLevel: number) => {
    const indent_level = currentLevel > 0 ? 0 : 1
    onChange(lineItems.map(item => item.id === id ? { ...item, indent_level } : item))
    await supabase.from('line_items').update({ indent_level }).eq('id', id)
  }, [lineItems, onChange, supabase])

  const deleteRow = useCallback(async (id: string) => {
    await supabase.from('line_items').delete().eq('id', id)
    onChange(lineItems.filter(item => item.id !== id))
  }, [lineItems, onChange, supabase])

  const handleDragEnd = useCallback(async () => {
    if (dragItem.current === null || dragOver.current === null) return
    const reordered = [...lineItems]
    const [moved] = reordered.splice(dragItem.current, 1)
    reordered.splice(dragOver.current, 0, moved)
    const updated = reordered.map((item, i) => ({ ...item, sort_order: i }))
    onChange(updated)
    dragItem.current = null
    dragOver.current = null
    await Promise.all(updated.map(item =>
      supabase.from('line_items').update({ sort_order: item.sort_order }).eq('id', item.id)
    ))
  }, [lineItems, onChange, supabase])

  const itemCount = lineItems.filter(i => i.row_type === 'item').length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Line Items</h2>
        <span className="text-xs text-[#8A877F]">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white border border-[#D8D3C8] rounded overflow-x-auto overflow-y-visible">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
              <th className="w-6 px-2 py-2" />
              <th className="text-left px-2 py-2 min-w-[140px]">Item</th>
              <th className="text-left px-2 py-2 min-w-[160px]">Description</th>
              <th className="text-right px-2 py-2 min-w-[64px] whitespace-nowrap">Qty</th>
              <th className="text-left px-2 py-2 min-w-[120px]">Supplier</th>
              <th className="text-left px-2 py-2 min-w-[120px] whitespace-nowrap">Deliver To</th>
              <th className="text-right px-2 py-2 min-w-[100px] whitespace-nowrap">Cost</th>
              <th className="text-right px-2 py-2 min-w-[80px] whitespace-nowrap">Mkup%</th>
              <th className="text-right px-2 py-2 min-w-[90px] whitespace-nowrap">Sale</th>
              <th className="text-right px-2 py-2 min-w-[90px] whitespace-nowrap">Profit</th>
              <th className="text-right px-2 py-2 min-w-[90px] whitespace-nowrap">Tot. Cost</th>
              <th className="text-right px-2 py-2 w-20 whitespace-nowrap">Tot. Price</th>
              <th className="w-7 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {

              // ── Section header row ──────────────────────────────────────
              if (item.row_type === 'section') {
                return (
                  <tr
                    key={item.id}
                    draggable
                    onDragStart={() => { dragItem.current = index }}
                    onDragEnter={() => { dragOver.current = index }}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    className="border-b border-[#D8D3C8] bg-[#F5F2EC] group"
                  >
                    <td className="px-1.5 py-2 text-[#C4BFB5] group-hover:text-[#8A877F] cursor-grab active:cursor-grabbing">
                      <GripVertical size={14} />
                    </td>
                    <td colSpan={11} className="px-2 py-2 border-r border-[#EDE9E1]">
                      <div className="flex items-center gap-2">
                        <div className="w-0.5 h-4 bg-[#9A7B4F] rounded-full flex-shrink-0" />
                        <input
                          value={item.item_name}
                          onChange={e => updateLocal(item.id, 'item_name', e.target.value)}
                          onBlur={e => saveField(item.id, 'item_name', e.target.value)}
                          className="flex-1 bg-transparent outline-none text-xs font-semibold text-[#5A5750] uppercase tracking-widest placeholder-[#C4BFB5] focus:text-[#2C2C2A]"
                          placeholder="Room / Section name…"
                        />
                      </div>
                    </td>
                    <td className="px-1.5 py-2">
                      <button
                        onClick={() => deleteRow(item.id)}
                        className="text-[#D8D3C8] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              }

              // ── Item row ────────────────────────────────────────────────
              const c = computeLineItem(item)
              const indented = item.indent_level > 0

              return (
                <tr
                  key={item.id}
                  draggable
                  onDragStart={() => { dragItem.current = index }}
                  onDragEnter={() => { dragOver.current = index }}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className={`border-b border-[#EDE9E1] last:border-0 hover:bg-[#FDFCF9] group ${indented ? 'bg-[#FDFCF9]' : ''}`}
                >
                  {/* Drag handle */}
                  <td className="px-1.5 py-1 text-[#D8D3C8] group-hover:text-[#8A877F] cursor-grab active:cursor-grabbing">
                    <GripVertical size={14} />
                  </td>

                  {/* Item name — with indent toggle + visual indent */}
                  <td className={COL}>
                    <div className={`flex items-center gap-1 ${indented ? 'pl-4' : ''}`}>
                      {indented && (
                        <CornerDownRight size={11} className="text-[#9A7B4F] flex-shrink-0 -mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <AutoTextarea
                          value={item.item_name}
                          onChange={v => updateLocal(item.id, 'item_name', v)}
                          onBlur={v => saveField(item.id, 'item_name', v)}
                          placeholder="Item name"
                          className={INPUT}
                        />
                      </div>
                      <button
                        onClick={() => toggleIndent(item.id, item.indent_level)}
                        title={indented ? 'Remove indent' : 'Attach to item above'}
                        className={`flex-shrink-0 p-0.5 rounded transition-colors cursor-pointer
                          ${indented
                            ? 'text-[#9A7B4F] opacity-100'
                            : 'text-[#D8D3C8] opacity-0 group-hover:opacity-100 hover:text-[#9A7B4F]'
                          }`}
                      >
                        <CornerDownRight size={12} />
                      </button>
                    </div>
                  </td>

                  {/* Description */}
                  <td className={COL + ' align-top'}>
                    <AutoTextarea
                      value={item.description ?? ''}
                      onChange={v => updateLocal(item.id, 'description', v)}
                      onBlur={v => saveField(item.id, 'description', v)}
                      placeholder="Description"
                      className={INPUT}
                    />
                  </td>

                  {/* Qty */}
                  <td className={COL}>
                    <input
                      type="number" min="0" step="1"
                      value={item.quantity}
                      onChange={e => updateLocal(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      onBlur={e => saveField(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className={NUM_INPUT}
                    />
                  </td>

                  {/* Supplier */}
                  <td className={COL + ' overflow-visible'}>
                    <Combobox
                      options={suppliers.map(s => ({ id: s.id, label: s.supplier_name }))}
                      value={item.supplier_id ?? ''}
                      inputValue={item.supplier_name ?? ''}
                      onChange={(id, label) => handleSupplierChange(item.id, id, label)}
                      onCreate={createSupplier}
                      placeholder="Supplier…"
                      className="min-w-[120px]"
                    />
                  </td>

                  {/* Deliver To */}
                  <td className={COL}>
                    <select
                      value={item.delivery_address ?? ''}
                      onChange={e => {
                        updateLocal(item.id, 'delivery_address', e.target.value)
                        saveField(item.id, 'delivery_address', e.target.value)
                      }}
                      className={INPUT + ' cursor-pointer'}
                    >
                      <option value="">— Deliver to —</option>
                      {officeAddress.address && (
                        <option value={officeAddress.address}>{officeAddress.name}</option>
                      )}
                      {suppliers
                        .filter(s => s.delivery_address)
                        .map(s => (
                          <option key={s.id} value={s.delivery_address!}>
                            {s.supplier_name}
                          </option>
                        ))
                      }
                    </select>
                  </td>

                  {/* Cost Price */}
                  <td className={COL}>
                    <CurrencyInput
                      value={item.cost_price}
                      onChange={v => updateLocal(item.id, 'cost_price', v)}
                      onBlur={v => saveField(item.id, 'cost_price', v)}
                      className={NUM_INPUT}
                    />
                  </td>

                  {/* Markup % */}
                  <td className={COL}>
                    <input
                      type="number" min="0" step="0.1"
                      value={item.markup_percentage}
                      onChange={e => updateLocal(item.id, 'markup_percentage', parseFloat(e.target.value) || 0)}
                      onBlur={e => saveField(item.id, 'markup_percentage', parseFloat(e.target.value) || 0)}
                      className={NUM_INPUT}
                    />
                  </td>

                  {/* Computed — readonly */}
                  <td className="px-2 py-1.5 text-right text-sm tabular-nums text-[#2C2C2A] font-medium whitespace-nowrap">
                    {formatZAR(c.sale_price)}
                  </td>
                  <td className={`px-2 py-1.5 text-right text-sm tabular-nums whitespace-nowrap ${c.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatZAR(c.profit)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm tabular-nums text-[#8A877F] whitespace-nowrap">
                    {formatZAR(c.total_cost)}
                  </td>
                  <td className="px-2 py-1.5 text-right text-sm tabular-nums text-[#2C2C2A] font-semibold whitespace-nowrap">
                    {formatZAR(c.total_price)}
                  </td>

                  {/* Delete */}
                  <td className="px-1.5 py-1">
                    <button
                      onClick={() => deleteRow(item.id)}
                      className="text-[#D8D3C8] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {lineItems.length === 0 && (
          <div className="py-12 text-center text-[#8A877F] text-sm">
            No items yet — add your first line item below
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-4">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-sm text-[#9A7B4F] hover:text-[#7d6340] transition-colors cursor-pointer"
        >
          <Plus size={14} /> Add item
        </button>
        <button
          onClick={addSection}
          className="flex items-center gap-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
        >
          <LayoutList size={14} /> Add room / section
        </button>
      </div>
    </div>
  )
}
