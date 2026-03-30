'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { computeLineItem, formatZAR } from '@/lib/quoting'
import type { LineItem } from '@/lib/types'
import { Plus, Trash2, GripVertical, CornerDownRight, LayoutList, ImageOff, HelpCircle, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { FabricSearch } from '@/components/ui/FabricSearch'
import toast from 'react-hot-toast'

function CurrencyInput({ value, onChange, onBlur, className }: { value: number; onChange: (v: number) => void; onBlur: (v: number) => void; className: string }) {
  const [focused, setFocused] = useState(false)
  if (focused) return (
    <input
      type="text" inputMode="decimal" autoFocus
      defaultValue={value}
      onChange={e => onChange(parseFloat(e.target.value.replace(',', '.')) || 0)}
      onBlur={e => { setFocused(false); onBlur(parseFloat(e.target.value.replace(',', '.')) || 0) }}
      className={className}
    />
  )
  return (
    <button onClick={() => setFocused(true)} className="w-full text-right text-sm tabular-nums text-[#2C2C2A] whitespace-nowrap cursor-text">
      {formatZAR(value)}
    </button>
  )
}

type Supplier = { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null; is_platform: boolean; price_list_id: string | null }

interface Props {
  projectId: string
  lineItems: LineItem[]
  suppliers: Supplier[]
  items: { id: string; item_name: string }[]
  officeAddress: { name: string; address: string }
  onChange: (items: LineItem[]) => void
  onSupplierCreated: (supplier: Supplier) => void
  activePriceListIds: string[]
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

const LINE_ITEM_TIPS = [
  { col: 'Item', tip: 'The name of the product or service. Type to search your saved items or enter a new name. Select a supplier with a price list first to enable fabric/product lookup.' },
  { col: 'Dimensions', tip: 'Width × height or other measurements (e.g. 2400 × 800). Shown on the Production Sheet. Not visible to the client.' },
  { col: 'Colour', tip: 'Colour, finish, or colourway of the item. Shown on the Production Sheet. Not visible to the client.' },
  { col: 'Description', tip: 'Optional detail shown on the Purchase Order PDF — fabric code, SKU, etc. Not shown on quotes or invoices.' },
  { col: 'Qty / Unit', tip: 'Quantity and unit of measure (e.g. 2 m², 4 each). Unit is shown alongside quantity on all documents.' },
  { col: 'Supplier', tip: 'Select the supplier for this item. Their default markup % will be applied automatically.' },
  { col: 'Deliver To', tip: 'Where this item should be delivered. Defaults to your office address.' },
  { col: 'Lead', tip: 'Estimated delivery time in weeks. Shown on Purchase Orders only — useful for tracking what to chase.' },
  { col: 'Cost', tip: 'Your cost price from the supplier (ex VAT). This is never shown to the client.' },
  { col: 'Mkup %', tip: 'Your markup percentage. Defaults to the supplier\'s markup. Edit per line if needed.' },
  { col: 'Sale', tip: 'The selling price shown to the client — calculated automatically from Cost + Markup.' },
  { col: 'Profit', tip: 'Your profit per unit (Sale minus Cost). Shown for your reference only.' },
  { col: 'Tot. Cost', tip: 'Total cost for this line (Cost × Qty).' },
  { col: 'Tot. Price', tip: 'Total selling price for this line (Sale × Qty). This appears on the quote/invoice.' },
]

export function LineItemsTable({ projectId, lineItems, suppliers, items, officeAddress, onChange, onSupplierCreated, activePriceListIds }: Props) {
  const supabase = createClient()
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)
  const [showTips, setShowTips] = useState(false)
  // Map of twinbru_product_id → current catalogue price (for stale price detection)
  const [cataloguePrices, setCataloguePrices] = useState<Record<number, number | null>>({})
  // Map of line item id → stock info
  const [stockMap, setStockMap] = useState<Record<string, { inStock: boolean; stockDate: string | null } | null>>({})
  const stockDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const fetchStock = useCallback((lineItemId: string, productId: string, quantity: number, autoFillLead?: (weeks: number) => void) => {
    if (stockDebounceRef.current[lineItemId]) clearTimeout(stockDebounceRef.current[lineItemId])
    stockDebounceRef.current[lineItemId] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fabric-stock?productId=${productId}&quantity=${Math.max(1, quantity)}`)
        const data = await res.json()
        if (data.stockDate !== undefined) {
          setStockMap(m => ({ ...m, [lineItemId]: data }))
          if (autoFillLead && !data.inStock && data.stockDate) {
            const weeks = Math.ceil((new Date(data.stockDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
            if (weeks > 0) autoFillLead(weeks)
          }
        }
      } catch { /* silent */ }
    }, 600)
  }, [])

  useEffect(() => {
    const ids = lineItems
      .map(i => i.twinbru_product_id)
      .filter((id): id is number => id != null)
    if (ids.length === 0) return
    supabase
      .from('price_list_items')
      .select('product_id, price_zar')
      .in('product_id', ids.map(String))
      .then(({ data }) => {
        if (!data) return
        const map: Record<number, number | null> = {}
        for (const row of data) {
          const pid = parseInt(row.product_id, 10)
          if (!isNaN(pid)) map[pid] = row.price_zar
        }
        setCataloguePrices(map)
      })
  // Only re-run when the set of twinbru product IDs changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems.map(i => i.twinbru_product_id).join(',')])

  // Re-fetch stock when quantity changes for twinbru items already in stockMap
  useEffect(() => {
    for (const item of lineItems) {
      if (item.twinbru_product_id && item.id in stockMap) {
        fetchStock(item.id, String(item.twinbru_product_id), item.quantity)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems.map(i => `${i.id}:${i.quantity}`).join(',')])

  const updateLocal = useCallback((id: string, field: string, value: string | number | null) => {
    onChange(lineItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }, [lineItems, onChange])

  const saveField = useCallback(async (id: string, field: string, value: string | number | null) => {
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
    // Skip DB write while user is mid-typing (supplierId empty but name has text)
    // to avoid race condition where typing nulls overwrite the final supplier ID write
    if (supplierId || !supplierName) {
      await supabase.from('line_items').update(updates).eq('id', lineItemId)
    }
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
    onSupplierCreated({ id: data.id, supplier_name: data.supplier_name, markup_percentage: data.markup_percentage, delivery_address: data.delivery_address ?? null, is_platform: false, price_list_id: null })
    return { id: data.id }
  }, [supabase, onSupplierCreated])

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

  const toggleReceived = useCallback(async (id: string, current: boolean) => {
    const received = !current
    onChange(lineItems.map(item => item.id === id ? { ...item, received } : item))
    await supabase.from('line_items').update({ received }).eq('id', id)
  }, [lineItems, onChange, supabase])

  const handleFabricSelect = useCallback(async (lineItemId: string, fabric: {
    design: string | null; collection: string | null; colour: string | null
    sku: string | null; brand: string | null; product_id: string | null
    price_zar: number | null; image_url: string | null
  }) => {
    const description = [fabric.brand, fabric.collection, fabric.design, fabric.colour, fabric.sku]
      .filter(Boolean).join(' · ')
    const twinbru_product_id = fabric.product_id ? parseInt(fabric.product_id, 10) || null : null
    const updates = {
      item_name: 'Fabric',
      description,
      cost_price: fabric.price_zar ?? 0,
      fabric_image_url: fabric.image_url ?? null,
      colour_finish: fabric.colour ?? null,
      twinbru_product_id,
      twinbru_cost_price: fabric.price_zar ?? null,
    }
    onChange(lineItems.map(item => item.id === lineItemId ? { ...item, ...updates } : item))
    await supabase.from('line_items').update(updates).eq('id', lineItemId)
    if (fabric.product_id) {
      const currentItem = lineItems.find(i => i.id === lineItemId)
      const qty = currentItem?.quantity ?? 1
      fetchStock(lineItemId, fabric.product_id, qty, async (weeks) => {
        // Only auto-fill if lead time is currently empty
        if (!currentItem?.lead_time_weeks) {
          onChange(lineItems.map(i => i.id === lineItemId ? { ...i, ...updates, lead_time_weeks: weeks } : i))
          await supabase.from('line_items').update({ lead_time_weeks: weeks }).eq('id', lineItemId)
        }
      })
    }
  }, [lineItems, onChange, supabase, fetchStock])

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
        <table className="w-full text-sm min-w-[1120px]">
          <thead>
            <tr className="border-b border-[#D8D3C8] bg-[#F5F2EC] text-xs text-[#8A877F] uppercase tracking-wider">
              <th className="w-6 px-2 py-2" />
              <th className="w-7 px-2 py-2" title="Received" />
              <th className="text-left px-2 py-2 min-w-[140px]">Item</th>
              <th className="text-left px-2 py-2 min-w-[160px]">Description</th>
              <th className="text-right px-2 py-2 min-w-[100px] whitespace-nowrap">Qty / Unit</th>
              <th className="text-left px-2 py-2 min-w-[120px]">Supplier</th>
              <th className="text-left px-2 py-2 min-w-[120px] whitespace-nowrap">Deliver To</th>
              <th className="text-right px-2 py-2 min-w-[70px] whitespace-nowrap">Lead</th>
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
                    <td />
                    <td colSpan={12} className="px-2 py-2 border-r border-[#EDE9E1]">
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
                  className={`border-b border-[#EDE9E1] last:border-0 group transition-colors
                    ${item.received
                      ? 'bg-blue-50 hover:bg-blue-50'
                      : indented ? 'bg-[#FDFCF9] hover:bg-[#FDFCF9]' : 'hover:bg-[#FDFCF9]'
                    }`}
                >
                  {/* Drag handle */}
                  <td className="px-1.5 py-1 text-[#D8D3C8] group-hover:text-[#8A877F] cursor-grab active:cursor-grabbing">
                    <GripVertical size={14} />
                  </td>

                  {/* Received checkbox */}
                  <td className="px-1.5 py-1">
                    <button
                      onClick={() => toggleReceived(item.id, item.received)}
                      title={item.received ? 'Mark as not received' : 'Mark as received'}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer flex-shrink-0
                        ${item.received
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'border-[#D8D3C8] hover:border-blue-400 opacity-0 group-hover:opacity-100'
                        }`}
                    >
                      {item.received && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </td>

                  {/* Item name — with indent toggle + visual indent + dimensions/colour */}
                  <td className={COL}>
                    <div className={indented ? 'pl-4' : ''}>
                      <div className="flex items-center gap-1">
                        {indented && (
                          <CornerDownRight size={11} className="text-[#9A7B4F] flex-shrink-0 -mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          {(() => { const pl = suppliers.find(s => s.id === item.supplier_id)?.price_list_id; return pl && activePriceListIds.includes(pl) })() ? (
                            <FabricSearch
                              value={item.item_name}
                              onChange={v => updateLocal(item.id, 'item_name', v)}
                              onBlur={v => saveField(item.id, 'item_name', v)}
                              onSelect={fabric => handleFabricSelect(item.id, fabric)}
                              placeholder="Search fabric…"
                              className={INPUT}
                            />
                          ) : (
                            <AutoTextarea
                              value={item.item_name}
                              onChange={v => updateLocal(item.id, 'item_name', v)}
                              onBlur={v => saveField(item.id, 'item_name', v)}
                              placeholder="Item name"
                              className={INPUT}
                            />
                          )}
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
                      <div className="flex gap-1 mt-0.5">
                        <input
                          value={item.dimensions ?? ''}
                          onChange={e => updateLocal(item.id, 'dimensions', e.target.value)}
                          onBlur={e => saveField(item.id, 'dimensions', e.target.value)}
                          placeholder="Dimensions…"
                          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-[#8A877F] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#D8D3C8]"
                        />
                        <input
                          value={item.colour_finish ?? ''}
                          onChange={e => updateLocal(item.id, 'colour_finish', e.target.value)}
                          onBlur={e => saveField(item.id, 'colour_finish', e.target.value)}
                          placeholder="Colour/finish…"
                          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-[#8A877F] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#D8D3C8]"
                        />
                      </div>
                      {item.twinbru_product_id && (() => {
                        const s = stockMap[item.id]
                        if (!s) return null
                        if (s.inStock) return (
                          <span className="inline-block mt-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">In Stock</span>
                        )
                        if (s.stockDate) {
                          const weeks = Math.ceil((new Date(s.stockDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
                          return (
                            <span className="inline-block mt-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">~{weeks}w lead time</span>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </td>

                  {/* Description */}
                  <td className={COL + ' align-top pr-4'}>
                    <AutoTextarea
                      value={item.description ?? ''}
                      onChange={v => updateLocal(item.id, 'description', v)}
                      onBlur={v => saveField(item.id, 'description', v)}
                      placeholder="Description"
                      className={INPUT}
                    />
                  </td>

                  {/* Qty + Unit */}
                  <td className={COL}>
                    <div className="flex items-center gap-1">
                      <input
                        type="text" inputMode="decimal"
                        value={item.quantity}
                        onChange={e => { const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'); updateLocal(item.id, 'quantity', v as unknown as number) }}
                        onBlur={e => saveField(item.id, 'quantity', parseFloat(e.target.value.replace(',', '.')) || 0)}
                        className={NUM_INPUT + ' flex-1'}
                      />
                      <input
                        list={`units-${item.id}`}
                        value={item.unit ?? ''}
                        onChange={e => updateLocal(item.id, 'unit', e.target.value)}
                        onBlur={e => saveField(item.id, 'unit', e.target.value)}
                        placeholder="unit"
                        className="w-12 bg-transparent outline-none text-xs text-[#8A877F] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#C4BFB5]"
                      />
                      <datalist id={`units-${item.id}`}>
                        {['each','m','m²','lm','pair','set','roll','kg'].map(u => <option key={u} value={u} />)}
                      </datalist>
                    </div>
                  </td>

                  {/* Supplier */}
                  <td className={COL}>
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
                  <td className={COL + ' overflow-visible'}>
                    {(() => {
                      const deliveryOptions = [
                        ...(officeAddress.address ? [{ id: officeAddress.address, label: officeAddress.name }] : []),
                        ...suppliers.filter(s => s.delivery_address).map(s => ({ id: s.delivery_address!, label: s.supplier_name })),
                      ]
                      const selected = deliveryOptions.find(o => o.id === item.delivery_address)
                      return (
                        <Combobox
                          options={deliveryOptions}
                          value={item.delivery_address ?? ''}
                          inputValue={selected?.label ?? item.delivery_address ?? ''}
                          onChange={(id, label) => {
                            const addr = id || label
                            updateLocal(item.id, 'delivery_address', addr)
                            saveField(item.id, 'delivery_address', addr)
                          }}
                          placeholder="Deliver to…"
                          className="min-w-[120px]"
                        />
                      )
                    })()}
                  </td>

                  {/* Lead time */}
                  <td className={COL}>
                    <div className="flex items-center gap-0.5 justify-end">
                      <input
                        type="number" min="0" step="1"
                        value={item.lead_time_weeks ?? ''}
                        onChange={e => updateLocal(item.id, 'lead_time_weeks', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                        onBlur={e => saveField(item.id, 'lead_time_weeks', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                        className="w-8 bg-transparent outline-none text-xs text-right tabular-nums text-[#2C2C2A] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#C4BFB5]"
                        placeholder="–"
                      />
                      <span className="text-xs text-[#8A877F] flex-shrink-0">wks</span>
                    </div>
                  </td>

                  {/* Cost Price */}
                  <td className={COL}>
                    {(() => {
                      const pid = item.twinbru_product_id
                      const currentCataloguePrice = pid != null ? cataloguePrices[pid] : undefined
                      const priceChanged = pid != null
                        && currentCataloguePrice !== undefined
                        && currentCataloguePrice !== null
                        && item.twinbru_cost_price !== null
                        && item.twinbru_cost_price !== currentCataloguePrice
                      return (
                        <div className="relative">
                          <CurrencyInput
                            value={item.cost_price}
                            onChange={v => updateLocal(item.id, 'cost_price', v)}
                            onBlur={v => saveField(item.id, 'cost_price', v)}
                            className={NUM_INPUT}
                          />
                          {priceChanged && (
                            <div
                              title={`Twinbru price updated to R${currentCataloguePrice?.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} — verify before sending`}
                              className="absolute -top-1 -right-1 text-amber-500 cursor-help"
                            >
                              <AlertTriangle size={11} />
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </td>

                  {/* Markup % */}
                  <td className={COL}>
                    <input
                      type="text" inputMode="decimal"
                      value={item.markup_percentage}
                      onChange={e => { const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'); updateLocal(item.id, 'markup_percentage', v as unknown as number) }}
                      onBlur={e => saveField(item.id, 'markup_percentage', parseFloat(e.target.value.replace(',', '.')) || 0)}
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
        <button
          onClick={() => setShowTips(v => !v)}
          className="flex items-center gap-1.5 text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors cursor-pointer ml-auto"
        >
          <HelpCircle size={13} />
          How do line items work?
          {showTips ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {showTips && (
        <div className="mt-3 bg-[#F5F2EC] border border-[#D8D3C8] rounded-lg p-4">
          <p className="text-xs font-medium text-[#2C2C2A] mb-3">Column guide</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {LINE_ITEM_TIPS.map(({ col, tip }) => (
              <div key={col} className="flex gap-2">
                <span className="text-xs font-medium text-[#9A7B4F] w-16 flex-shrink-0">{col}</span>
                <span className="text-xs text-[#8A877F] leading-relaxed">{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
