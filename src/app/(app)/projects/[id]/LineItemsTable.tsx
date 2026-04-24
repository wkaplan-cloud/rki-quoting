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

type Supplier = { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null; is_platform: boolean; price_list_id: string | null; email: string | null }

interface Props {
  projectId: string
  lineItems: LineItem[]
  suppliers: Supplier[]
  items: { id: string; item_name: string }[]
  officeAddress: { name: string; address: string }
  onChange: (items: LineItem[]) => void
  onSupplierCreated: (supplier: Supplier) => void
  activePriceListIds: string[]
  locked?: boolean
  depositReceived?: boolean
}

const COL = 'px-2 py-1.5 border-r border-[#EDE9E1] last:border-0'
const INPUT = 'w-full bg-transparent outline-none text-sm text-[#2C2C2A] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 transition-colors placeholder-[#C4BFB5]'
const NUM_INPUT = INPUT + ' text-right tabular-nums'

function AutoTextarea({ value, onChange, onBlur, placeholder, className, readOnly }: {
  value: string
  onChange: (v: string) => void
  onBlur: (v: string) => void
  placeholder?: string
  className?: string
  readOnly?: boolean
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
      readOnly={readOnly}
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
  { col: 'Indent', tip: 'Use the indent button (↳) to nest a line under the one above — useful for sub-items like fabric under a sofa. Indented rows are slightly inset on the Production Sheet.' },
]

export function LineItemsTable({ projectId, lineItems, suppliers, items, officeAddress, onChange, onSupplierCreated, activePriceListIds, locked, depositReceived }: Props) {
  const supabase = createClient()
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)
  const [showTips, setShowTips] = useState(false)
  // Delivery address prompt modal
  const [addDeliveryModal, setAddDeliveryModal] = useState<{ supplierId: string; supplierName: string; lineItemId: string; address: string } | null>(null)
  // Local delivery address overrides (supplierId → address) for addresses added this session
  const [deliveryOverrides, setDeliveryOverrides] = useState<Record<string, string>>({})
  // Map of twinbru_product_id → current catalogue price (for stale price detection)
  const [cataloguePrices, setCataloguePrices] = useState<Record<number, number | null>>({})
  // Map of line item id → stock info
  const [stockMap, setStockMap] = useState<Record<string, { localQty: number | null; transitQty: number | null; transitDate: string | null; maxLeadTimeDate: string | null; weeksUntilAvailable: number | null } | null>>({})
  const stockDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const fetchStock = useCallback((lineItemId: string, productId: string, _quantity: number, autoFillLead?: (info: { localQty: number | null; transitQty: number | null; transitDate: string | null; maxLeadTimeDate: string | null; weeksUntilAvailable: number | null }) => void) => {
    if (stockDebounceRef.current[lineItemId]) clearTimeout(stockDebounceRef.current[lineItemId])
    stockDebounceRef.current[lineItemId] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/fabric-stock?productId=${productId}`)
        const data = await res.json()
        if (data.weeksUntilAvailable !== undefined) {
          setStockMap(m => ({ ...m, [lineItemId]: data }))
          if (autoFillLead) autoFillLead(data)
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

  // Fetch stock on initial load for all Home Fabrics items (only before deposit received)
  useEffect(() => {
    if (depositReceived) return
    for (const item of lineItems) {
      if (item.twinbru_product_id) {
        fetchStock(item.id, String(item.twinbru_product_id), item.quantity)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch stock when quantity changes for twinbru items already in stockMap
  useEffect(() => {
    if (depositReceived) return
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
    onSupplierCreated({ id: data.id, supplier_name: data.supplier_name, markup_percentage: data.markup_percentage, delivery_address: data.delivery_address ?? null, is_platform: false, price_list_id: null, email: data.email ?? null })
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
      markup_percentage: 0,
      delivery_address: officeAddress.address || '',
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
      unit: 'm',
    }
    onChange(lineItems.map(item => item.id === lineItemId ? { ...item, ...updates } : item))
    await supabase.from('line_items').update(updates).eq('id', lineItemId)
    if (fabric.product_id) {
      const currentItem = lineItems.find(i => i.id === lineItemId)
      const qty = currentItem?.quantity ?? 1
      fetchStock(lineItemId, fabric.product_id, qty, async (stockInfo) => {
        const transitDays = stockInfo.transitDate
          ? Math.ceil((new Date(stockInfo.transitDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : null
        const isInStock = (stockInfo.localQty != null && stockInfo.localQty > 0) || (transitDays != null && transitDays <= 1)
        const transitWeeks = stockInfo.transitDate && transitDays != null && transitDays > 1
          ? Math.ceil(transitDays / 7)
          : null

        if (isInStock) {
          // Green badge — 2 days lead time
          onChange(lineItems.map(i => i.id === lineItemId ? { ...i, ...updates, lead_time_days: 2, lead_time_weeks: null } : i))
          await supabase.from('line_items').update({ lead_time_days: 2, lead_time_weeks: null }).eq('id', lineItemId)
        } else if (transitWeeks != null) {
          // Blue badge — set weeks, clear days
          onChange(lineItems.map(i => i.id === lineItemId ? { ...i, ...updates, lead_time_weeks: transitWeeks, lead_time_days: null } : i))
          await supabase.from('line_items').update({ lead_time_weeks: transitWeeks, lead_time_days: null }).eq('id', lineItemId)
        }
        // Amber — don't touch lead time
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
              <th className="text-right px-2 py-2 min-w-[130px] whitespace-nowrap">Qty / Unit</th>
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
                    draggable={!locked}
                    onDragStart={!locked ? () => { dragItem.current = index } : undefined}
                    onDragEnter={!locked ? () => { dragOver.current = index } : undefined}
                    onDragEnd={!locked ? handleDragEnd : undefined}
                    onDragOver={!locked ? e => e.preventDefault() : undefined}
                    className="border-b border-[#D8D3C8] bg-[#F5F2EC] group"
                  >
                    <td className={`px-1.5 py-2 text-[#C4BFB5] ${!locked ? 'group-hover:text-[#8A877F] cursor-grab active:cursor-grabbing' : ''}`}>
                      {!locked && <GripVertical size={14} />}
                    </td>
                    <td />
                    <td colSpan={12} className="px-2 py-2 border-r border-[#EDE9E1]">
                      <div className="flex items-center gap-2">
                        <div className="w-0.5 h-4 bg-[#9A7B4F] rounded-full flex-shrink-0" />
                        <input
                          value={item.item_name}
                          onChange={e => updateLocal(item.id, 'item_name', e.target.value)}
                          onBlur={e => saveField(item.id, 'item_name', e.target.value)}
                          readOnly={locked}
                          className="flex-1 bg-transparent outline-none text-xs font-semibold text-[#5A5750] uppercase tracking-widest placeholder-[#C4BFB5] focus:text-[#2C2C2A]"
                          placeholder="Room / Section name…"
                        />
                      </div>
                    </td>
                    <td className="px-1.5 py-2">
                      {!locked && (
                        <button
                          onClick={() => deleteRow(item.id)}
                          className="text-[#D8D3C8] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
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
                  draggable={!locked}
                  onDragStart={!locked ? () => { dragItem.current = index } : undefined}
                  onDragEnter={!locked ? () => { dragOver.current = index } : undefined}
                  onDragEnd={!locked ? handleDragEnd : undefined}
                  onDragOver={!locked ? e => e.preventDefault() : undefined}
                  className={`border-b border-[#EDE9E1] last:border-0 group transition-colors
                    ${item.received
                      ? 'bg-blue-50 hover:bg-blue-50'
                      : indented ? 'bg-[#FDFCF9] hover:bg-[#FDFCF9]' : 'hover:bg-[#FDFCF9]'
                    }`}
                >
                  {/* Drag handle */}
                  <td className={`px-1.5 py-1 text-[#D8D3C8] ${!locked ? 'group-hover:text-[#8A877F] cursor-grab active:cursor-grabbing' : ''}`}>
                    {!locked && <GripVertical size={14} />}
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
                              readOnly={locked}
                            />
                          )}
                        </div>
                        {!locked && (
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
                        )}
                      </div>
                      <div className="flex gap-1 mt-0.5">
                        <input
                          value={item.dimensions ?? ''}
                          onChange={e => updateLocal(item.id, 'dimensions', e.target.value)}
                          onBlur={e => saveField(item.id, 'dimensions', e.target.value)}
                          placeholder="Dimensions…"
                          readOnly={locked}
                          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-[#8A877F] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#D8D3C8]"
                        />
                        <input
                          value={item.colour_finish ?? ''}
                          onChange={e => updateLocal(item.id, 'colour_finish', e.target.value)}
                          onBlur={e => saveField(item.id, 'colour_finish', e.target.value)}
                          placeholder="Colour/finish…"
                          readOnly={locked}
                          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-[#8A877F] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#D8D3C8]"
                        />
                      </div>
                      {!depositReceived && item.twinbru_product_id && (() => {
                        const s = stockMap[item.id]
                        if (!s) return null
                        return (
                          <div className="flex flex-col gap-0.5 mt-1">
                            {(() => {
                              const transitDays = s.transitDate ? Math.ceil((new Date(s.transitDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
                              const transitIsNextDay = transitDays != null && transitDays <= 1
                              const localQty = (s.localQty ?? 0) + (transitIsNextDay && s.transitQty ? s.transitQty : 0)
                              const showLocal = localQty > 0
                              const showTransit = s.transitQty != null && s.transitDate && !transitIsNextDay
                              return <>
                                {showLocal && (
                                  <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{localQty.toLocaleString()}m — in stock</span>
                                )}
                                {showTransit && (
                                  <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{s.transitQty!.toLocaleString()}m — in transit (~{Math.ceil((new Date(s.transitDate!).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))}w)</span>
                                )}
                                {!showLocal && !showTransit && s.maxLeadTimeDate && (
                                  <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">~{Math.max(1, Math.ceil((new Date(s.maxLeadTimeDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))}w lead time</span>
                                )}
                              </>
                            })()}
                          </div>
                        )
                      })()}
                      {item.twinbru_cost_price != null && (() => {
                        const rollPrice = Math.round(item.twinbru_cost_price * 0.9 * 40 * 100) / 100
                        const isRoll = item.unit === 'roll'
                        const setMode = async (roll: boolean) => {
                          const cost_price = roll ? rollPrice : item.twinbru_cost_price!
                          const quantity = roll ? 1 : item.quantity
                          const unit = roll ? 'roll' : 'm'
                          onChange(lineItems.map(i => i.id === item.id ? { ...i, cost_price, quantity, unit } : i))
                          await supabase.from('line_items').update({ cost_price, quantity, unit }).eq('id', item.id)
                        }
                        if (locked) return null
                        return (
                          <div className="flex items-center gap-0.5 mt-1">
                            <button
                              onClick={() => setMode(false)}
                              className={`text-[9px] px-1.5 py-0.5 rounded-l-full border transition-colors cursor-pointer ${!isRoll ? 'bg-[#9A7B4F] border-[#9A7B4F] text-white' : 'bg-white border-[#D8D3C8] text-[#8A877F] hover:border-[#9A7B4F]'}`}
                            >Cut</button>
                            <button
                              onClick={() => setMode(true)}
                              className={`text-[9px] px-1.5 py-0.5 rounded-r-full border transition-colors cursor-pointer ${isRoll ? 'bg-[#9A7B4F] border-[#9A7B4F] text-white' : 'bg-white border-[#D8D3C8] text-[#8A877F] hover:border-[#9A7B4F]'}`}
                            >Roll</button>
                          </div>
                        )
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
                      readOnly={locked}
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
                        readOnly={locked}
                        className={NUM_INPUT + ' flex-1'}
                      />
                      <input
                        list={`units-${item.id}`}
                        value={item.unit ?? ''}
                        onChange={e => updateLocal(item.id, 'unit', e.target.value)}
                        onBlur={e => saveField(item.id, 'unit', e.target.value)}
                        onFocus={e => e.target.select()}
                        placeholder="unit"
                        readOnly={locked}
                        className="w-12 bg-transparent outline-none text-xs text-[#8A877F] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#C4BFB5]"
                      />
                      <datalist id={`units-${item.id}`}>
                        {['each','m','m²','lm','roll','pair','set','kg'].map(u => <option key={u} value={u} />)}
                      </datalist>
                    </div>
                  </td>

                  {/* Supplier */}
                  <td className={COL}>
                    {locked
                      ? <span className="text-sm text-[#2C2C2A]">{item.supplier_name ?? '—'}</span>
                      : <Combobox
                          options={suppliers.map(s => ({ id: s.id, label: s.supplier_name, isPlatform: s.is_platform }))}
                          value={item.supplier_id ?? ''}
                          inputValue={item.supplier_name ?? ''}
                          onChange={(id, label) => handleSupplierChange(item.id, id, label)}
                          onCreate={createSupplier}
                          placeholder="Supplier…"
                          className="min-w-[120px]"
                        />
                    }
                  </td>

                  {/* Deliver To */}
                  <td className={COL + ' overflow-visible'}>
                    {locked
                      ? (() => {
                          const raw = item.delivery_address ?? '—'
                          const parts = raw.split('\n')
                          return parts.length > 1
                            ? <span className="text-sm text-[#2C2C2A] leading-snug"><span className="font-medium">{parts[0]}</span><br /><span className="text-[#8A877F]">{parts.slice(1).join(', ')}</span></span>
                            : <span className="text-sm text-[#2C2C2A]">{raw}</span>
                        })()
                      : (() => {
                          const deliveryOptions = [
                            ...(officeAddress.address ? [{ id: officeAddress.address, label: officeAddress.name }] : []),
                            ...suppliers.map(s => {
                              const addr = deliveryOverrides[s.id] ?? s.delivery_address
                              return addr
                                ? { id: `${s.supplier_name}\n${addr}`, label: s.supplier_name }
                                : { id: `supplier:${s.id}`, label: s.supplier_name }
                            }),
                          ]
                          const selected = deliveryOptions.find(o => o.id === item.delivery_address)
                          return (
                            <Combobox
                              options={deliveryOptions}
                              value={item.delivery_address ?? ''}
                              inputValue={selected?.label ?? (item.delivery_address?.split('\n')[0] ?? '')}
                              onChange={(id, label) => {
                                if (id.startsWith('supplier:')) {
                                  const supplierId = id.replace('supplier:', '')
                                  const sup = suppliers.find(s => s.id === supplierId)
                                  if (sup) setAddDeliveryModal({ supplierId, supplierName: sup.supplier_name, lineItemId: item.id, address: '' })
                                } else {
                                  const addr = id || label
                                  updateLocal(item.id, 'delivery_address', addr)
                                  saveField(item.id, 'delivery_address', addr)
                                }
                              }}
                              placeholder="Deliver to…"
                              className="min-w-[120px]"
                            />
                          )
                        })()
                    }
                  </td>

                  {/* Lead time */}
                  <td className={COL}>
                    {item.lead_time_days != null ? (
                      <div className="flex items-center gap-0.5 justify-end">
                        <input
                          type="number" min="0" step="1"
                          value={item.lead_time_days}
                          onChange={e => updateLocal(item.id, 'lead_time_days', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                          onBlur={e => saveField(item.id, 'lead_time_days', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                          readOnly={locked}
                          className="w-8 bg-transparent outline-none text-xs text-right tabular-nums text-[#2C2C2A] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#C4BFB5]"
                          placeholder="–"
                        />
                        <span className="text-xs text-[#8A877F] flex-shrink-0">days</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5 justify-end">
                        <input
                          type="number" min="0" step="1"
                          value={item.lead_time_weeks ?? ''}
                          onChange={e => updateLocal(item.id, 'lead_time_weeks', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                          onBlur={e => saveField(item.id, 'lead_time_weeks', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                          readOnly={locked}
                          className="w-8 bg-transparent outline-none text-xs text-right tabular-nums text-[#2C2C2A] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#C4BFB5]"
                          placeholder="–"
                        />
                        <span className="text-xs text-[#8A877F] flex-shrink-0">wks</span>
                      </div>
                    )}
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
                              className="absolute -top-1.5 -right-1 flex items-center gap-0.5 text-amber-500 cursor-help"
                            >
                              <AlertTriangle size={11} />
                              <span className="text-[9px] font-semibold leading-none">Price updated</span>
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
                      readOnly={locked}
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
                    {!locked && (
                      <button
                        onClick={() => deleteRow(item.id)}
                        className="text-[#D8D3C8] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
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

      {!locked && (
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
      )}
      {!locked && (
        <>
          <p className="mt-2 text-xs text-[#9A7B4F]/80 leading-relaxed">
            To search fabrics and pull in live pricing, select a platform supplier (shown in gold) on the line item first — the item name field will become a live fabric search.
          </p>
          <div className="mt-1 flex items-center gap-4">
            <button
              onClick={() => setShowTips(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors cursor-pointer ml-auto"
            >
              <HelpCircle size={13} />
              How do line items work?
              {showTips ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </>
      )}

      {!locked && showTips && (
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

      {/* Add delivery address modal */}
      {addDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setAddDeliveryModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[420px] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#2C2C2A] mb-1">Add delivery address for {addDeliveryModal.supplierName}</h3>
            <p className="text-xs text-[#8A877F] mb-4">This address will be saved to the supplier and used as the default deliver-to for their items.</p>
            <textarea
              autoFocus
              rows={3}
              placeholder="e.g. 12 Industrial Ave, Cape Town, 7441"
              value={addDeliveryModal.address}
              onChange={e => setAddDeliveryModal(prev => prev ? { ...prev, address: e.target.value } : null)}
              className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg focus:outline-none focus:border-[#9A7B4F] mb-4 resize-none leading-relaxed"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddDeliveryModal(null)} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                disabled={!addDeliveryModal.address.trim()}
                onClick={async () => {
                  const { supplierId, supplierName, lineItemId, address } = addDeliveryModal
                  const trimmed = address.trim()
                  const combined = `${supplierName}\n${trimmed}`
                  setAddDeliveryModal(null)
                  // Save to supplier record
                  await fetch(`/api/suppliers/${supplierId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ delivery_address: trimmed }),
                  })
                  // Update local override so dropdown reflects the new address immediately
                  setDeliveryOverrides(prev => ({ ...prev, [supplierId]: trimmed }))
                  // Save to the line item with supplier name prepended
                  updateLocal(lineItemId, 'delivery_address', combined)
                  saveField(lineItemId, 'delivery_address', combined)
                }}
                className="px-4 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Save Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
