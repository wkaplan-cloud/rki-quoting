'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { computeLineItem, formatZAR } from '@/lib/quoting'
import type { LineItem } from '@/lib/types'
import { Plus, Trash2, GripVertical, CornerDownRight, LayoutList, ImageOff, HelpCircle, ChevronDown, ChevronUp, AlertTriangle, Link2, Unlink2, ImagePlus, Upload, X, Loader2 } from 'lucide-react'
import { Combobox } from '@/components/ui/Combobox'
import { FabricSearch } from '@/components/ui/FabricSearch'
import { compressImage } from '@/lib/compressImage'
import toast from 'react-hot-toast'

// Line item images print at 1.5cm (42.5pt) on the quote/invoice. 400px on the
// longest side is ~677 DPI at that size — far past the 300 DPI print threshold —
// and still crisp in the app's own preview at 2x pixel density.
const LINE_ITEM_IMAGE_MAX_DIM = 400

function CurrencyInput({ value, onChange, onBlur, className }: { value: number; onChange: (v: number) => void; onBlur: (v: number) => void; className: string }) {
  const [focused, setFocused] = useState(false)
  if (focused) return (
    <input
      type="text" inputMode="decimal" autoFocus
      defaultValue={value === 0 ? '' : value}
      onFocus={e => e.target.select()}
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

type Supplier = { id: string; supplier_name: string; markup_percentage: number; delivery_address: string | null; delivery_contact_name: string | null; delivery_contact_number: string | null; is_platform: boolean; price_list_id: string | null; email: string | null }

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
  /** Platform feature flag — when off, the image thumbnail/upload UI is hidden entirely. */
  imagesEnabled?: boolean
}

const COL = 'px-2 py-1.5'
const INPUT = 'w-full bg-transparent outline-none text-sm text-[#2C2C2A] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 transition-colors placeholder-[#C4BFB5]'
const NUM_INPUT = INPUT + ' text-right tabular-nums'

// leading-snug = 1.375, text-sm = 14px → 3 lines ≈ 57.75px
const DESC_CLAMP_PX = 14 * 1.375 * 3

function AutoTextarea({ value, onChange, onBlur, onFocus, placeholder, className, readOnly, autoFocus }: {
  value: string
  onChange: (v: string) => void
  onBlur: (v: string) => void
  onFocus?: () => void
  placeholder?: string
  className?: string
  readOnly?: boolean
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  const [overflows, setOverflows] = useState(false)

  const applyHeight = useCallback((isFocused: boolean) => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const full = el.scrollHeight
    setOverflows(full > DESC_CLAMP_PX + 2)
    if (isFocused) {
      el.style.maxHeight = 'none'
      el.style.height = full + 'px'
    } else {
      el.style.maxHeight = DESC_CLAMP_PX + 'px'
      el.style.height = Math.min(full, DESC_CLAMP_PX) + 'px'
    }
  }, [])

  useEffect(() => { applyHeight(focused) }, [value, focused, applyHeight])

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={e => { onChange(e.target.value) }}
        onBlur={e => { setFocused(false); onBlur(e.target.value) }}
        onFocus={() => { setFocused(true); onFocus?.() }}
        placeholder={placeholder}
        readOnly={readOnly}
        className={className + ' resize-none overflow-hidden leading-snug w-full'}
        style={{ minHeight: '26px' }}
      />
      {!focused && overflows && (
        <div
          className="absolute bottom-0 left-0 right-0 h-5 pointer-events-none rounded-b"
          style={{ background: 'linear-gradient(to top, rgba(253,252,251,0.97), transparent)' }}
        />
      )}
    </div>
  )
}

const LINE_ITEM_TIPS = [
  { col: 'Item', tip: 'The name of the product or service. Type to search your saved items or enter a new name. Select a supplier with a price list first to enable fabric/product lookup.' },
  { col: 'Dimensions', tip: 'Width × height or other measurements (e.g. 2400 × 800). Shown on the Job Cost Sheet. Not visible to the client.' },
  { col: 'Colour', tip: 'Colour, finish, or colourway of the item. Shown on the Job Cost Sheet. Not visible to the client.' },
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

export function LineItemsTable({ projectId, lineItems, suppliers, items, officeAddress, onChange, onSupplierCreated, activePriceListIds, locked, depositReceived, imagesEnabled = false }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)
  const [showTips, setShowTips] = useState(false)
  // Delivery address prompt modal
  const [addDeliveryModal, setAddDeliveryModal] = useState<{ supplierId: string; supplierName: string; lineItemId: string; address: string; contactName: string; contactNumber: string } | null>(null)
  // Local delivery address overrides (supplierId → address) for addresses added this session
  const [deliveryOverrides, setDeliveryOverrides] = useState<Record<string, string>>({})
  // Drops popover: which line item id is open, and form values
  const [dropsOpen, setDropsOpen] = useState<string | null>(null)
  const [dropsForm, setDropsForm] = useState<{ drops: string; height: string }>({ drops: '', height: '' })
  // "Set cost as % off sale" quick-entry — only relevant while Sale is overridden
  const [discountOpen, setDiscountOpen] = useState<string | null>(null)
  const [discountValue, setDiscountValue] = useState('')
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null)
  // Map of twinbru_product_id → current catalogue price (for stale price detection)
  const [cataloguePrices, setCataloguePrices] = useState<Record<number, number | null>>({})
  // Map of twinbru_product_id → fabric width in cm (from price list)
  const [widthMap, setWidthMap] = useState<Record<number, number | null>>({})
  // Map of line item id → stock info
  const [stockMap, setStockMap] = useState<Record<string, { localQty: number | null; transitQty: number | null; transitDate: string | null; maxLeadTimeDate: string | null; weeksUntilAvailable: number | null } | null>>({})
  const stockDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Map of line item id → name of the section it currently falls under (nearest preceding section row by sort_order)
  const sectionNameById = useMemo(() => {
    const sorted = [...lineItems].sort((a, b) => a.sort_order - b.sort_order)
    const map = new Map<string, string | null>()
    let current: string | null = null
    for (const li of sorted) {
      if (li.row_type === 'section') { current = li.item_name || null; continue }
      map.set(li.id, current)
    }
    return map
  }, [lineItems])
  // New supplier mini-form modal (lineItemId = which row triggered it)
  const [newSupplierModal, setNewSupplierModal] = useState<{ name: string; email: string; markup: string; lineItemId: string } | null>(null)

  // Per-line-item images
  const [imageModal, setImageModal] = useState<{ lineItemId: string; itemName: string } | null>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const lineItemsRef = useRef(lineItems)
  useEffect(() => { lineItemsRef.current = lineItems }, [lineItems])
  // Tracks description value at focus-time so we can diff before/after for audit
  const lockedDescFocusRef = useRef<{ id: string; value: string } | null>(null)

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
      .select('product_id, price_zar, useable_width_cm')
      .in('product_id', ids.map(String))
      .then(({ data }) => {
        if (!data) return
        const priceMap: Record<number, number | null> = {}
        const wMap: Record<number, number | null> = {}
        for (const row of data) {
          const pid = parseInt(row.product_id, 10)
          if (!isNaN(pid)) {
            priceMap[pid] = row.price_zar
            wMap[pid] = row.useable_width_cm ?? null
          }
        }
        setCataloguePrices(priceMap)
        setWidthMap(wMap)
      })
  // Only re-run when the set of twinbru product IDs changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems.map(i => i.twinbru_product_id).join(',')])

  // Fetch stock on initial load for all Home Fabrics items (only before deposit received)
  useEffect(() => {
    if (depositReceived) return
    for (const item of lineItems) {
      if (item.twinbru_product_id) {
        const itemId = item.id
        const productId = String(item.twinbru_product_id)
        fetchStock(itemId, productId, item.quantity, async (stockInfo) => {
          const transitDays = stockInfo.transitDate
            ? Math.ceil((new Date(stockInfo.transitDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
            : null
          const isInStock = (stockInfo.localQty != null && stockInfo.localQty > 0) || (transitDays != null && transitDays <= 1)
          const transitWeeks = stockInfo.transitDate && transitDays != null && transitDays > 1
            ? Math.ceil(transitDays / 7)
            : null
          if (isInStock) {
            onChange(lineItemsRef.current.map(i => i.id === itemId ? { ...i, lead_time_days: 2, lead_time_weeks: null } : i))
            await supabase.from('line_items').update({ lead_time_days: 2, lead_time_weeks: null }).eq('id', itemId)
          } else if (transitWeeks != null) {
            onChange(lineItemsRef.current.map(i => i.id === itemId ? { ...i, lead_time_weeks: transitWeeks, lead_time_days: null } : i))
            await supabase.from('line_items').update({ lead_time_weeks: transitWeeks, lead_time_days: null }).eq('id', itemId)
          }
          // Amber — leave lead time unchanged
        })
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

  const updateLocal = useCallback((id: string, field: string, value: string | number | string[] | null) => {
    onChange(lineItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }, [lineItems, onChange])

  // Storage buckets reject direct browser uploads — these go through the API
  // route, which writes with the admin client.
  async function uploadLineItemImages(lineItemId: string, files: FileList | null) {
    if (!files?.length) return
    setUploadingImages(true)
    try {
      // Downscale to LINE_ITEM_IMAGE_MAX_DIM and re-encode to JPEG before upload.
      // Keeps files ~30-50KB and guarantees react-pdf can render them — it
      // handles only JPEG and PNG, so a WebP/AVIF original would break the PDF.
      let compressed: File[]
      try {
        compressed = await Promise.all(
          Array.from(files).map(f => compressImage(f, LINE_ITEM_IMAGE_MAX_DIM)),
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not read image')
        return
      }

      const fd = new FormData()
      compressed.forEach(f => fd.append('files', f))
      const res = await fetch(`/api/line-items/${lineItemId}/images`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Upload failed'); return }
      updateLocal(lineItemId, 'image_urls', json.all_urls)
      router.refresh()
      toast.success(json.urls.length === 1 ? 'Image added' : `${json.urls.length} images added`)
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingImages(false)
    }
  }

  async function deleteLineItemImage(lineItemId: string, url: string) {
    const res = await fetch(`/api/line-items/${lineItemId}/images`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Could not remove image'); return }
    updateLocal(lineItemId, 'image_urls', json.all_urls)
    router.refresh()
  }

  const saveField = useCallback(async (id: string, field: string, value: string | number | null, oldDescriptionValue?: string | null) => {
    await supabase.from('line_items').update({ [field]: value }).eq('id', id)
    router.refresh()
    if (field === 'description' && locked && oldDescriptionValue !== undefined && oldDescriptionValue !== value) {
      const [{ data: { user } }, { data: orgId }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('get_current_org_id'),
      ])
      const item = lineItemsRef.current.find(i => i.id === id)
      await supabase.from('audit_logs').insert({
        org_id: orgId,
        project_id: projectId,
        user_email: user?.email ?? null,
        action: 'updated',
        table_name: 'line_items',
        record_id: id,
        old_data: { description: oldDescriptionValue, item_name: item?.item_name ?? null },
        new_data: { description: value, item_name: item?.item_name ?? null },
      })
    }
  }, [supabase, locked, projectId])

  // When Sale is overridden, Cost and Mkup% both derive from it — editing Cost
  // (directly or via the "% off sale" quick-entry) recomputes the exact markup
  // so the field never shows a stale number. Mirrors the reverse (Sale-edit → markup)
  // logic below in the Sale cell's onBlur.
  const handleCostChange = useCallback(async (id: string, cost_price: number) => {
    const current = lineItemsRef.current.find(i => i.id === id)
    if (current?.sale_price_override != null) {
      const markup_percentage = cost_price > 0
        ? Math.round((current.sale_price_override / cost_price - 1) * 10000) / 100
        : 0
      onChange(lineItemsRef.current.map(li => li.id === id ? { ...li, cost_price, markup_percentage } : li))
      await supabase.from('line_items').update({ cost_price, markup_percentage }).eq('id', id)
    } else {
      onChange(lineItemsRef.current.map(li => li.id === id ? { ...li, cost_price } : li))
      await supabase.from('line_items').update({ cost_price }).eq('id', id)
    }
    router.refresh()
  }, [onChange, supabase, router])

  const applyCostDiscount = useCallback((id: string, discountPct: number) => {
    const current = lineItemsRef.current.find(i => i.id === id)
    if (!current || current.sale_price_override == null) return
    const cost_price = Math.round(current.sale_price_override * (1 - discountPct / 100) * 100) / 100
    handleCostChange(id, cost_price)
  }, [handleCostChange])

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

  const createSupplierForItem = useCallback((lineItemId: string, name: string) => {
    setNewSupplierModal({ name, email: '', markup: '0', lineItemId })
  }, [])

  const insertRowBefore = useCallback(async (index: number) => {
    // Insert at a non-colliding sort_order (max+1) — the unique
    // (project_id, sort_order) constraint rejects a hardcoded 0 whenever a
    // row already holds 0. The renumber-upsert below then moves it into place.
    const sort_order = lineItems.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1
    const { data, error } = await supabase.from('line_items').insert({
      project_id: projectId,
      item_name: '',
      description: '',
      quantity: 1,
      cost_price: 0,
      markup_percentage: 0,
      delivery_address: officeAddress.address ? `${officeAddress.name}\n${officeAddress.address}` : '',
      sort_order,
      row_type: 'item',
      indent_level: 0,
    }).select().single()
    if (error) { toast.error('Failed to insert row'); return }
    const spliced = [...lineItems]
    spliced.splice(index + 1, 0, data)
    const renumbered = spliced.map((item, i) => ({ ...item, sort_order: i }))
    onChange(renumbered)
    setNewlyAddedId(data.id)
    const { error: reorderError } = await supabase.from('line_items')
      .upsert(renumbered.map(item => ({ id: item.id, project_id: projectId, sort_order: item.sort_order })), { onConflict: 'id' })
    if (reorderError) {
      toast.error('Failed to save new row order — please refresh')
    }
  }, [projectId, lineItems, onChange, supabase, officeAddress])

  const addRow = useCallback(async () => {
    const sort_order = lineItems.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1
    const { data, error } = await supabase.from('line_items').insert({
      project_id: projectId,
      item_name: '',
      description: '',
      quantity: 1,
      cost_price: 0,
      markup_percentage: 0,
      delivery_address: officeAddress.address ? `${officeAddress.name}\n${officeAddress.address}` : '',
      sort_order,
      row_type: 'item',
      indent_level: 0,
    }).select().single()
    if (error) { toast.error('Failed to add row'); return }
    onChange([...lineItems, data])
    setNewlyAddedId(data.id)
  }, [projectId, lineItems, onChange, supabase])

  const addSection = useCallback(async () => {
    const sort_order = lineItems.reduce((max, item) => Math.max(max, item.sort_order), -1) + 1
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
    setNewlyAddedId(data.id)
  }, [projectId, lineItems, onChange, supabase])

  const cycleHighlight = useCallback(async (id: string, current: string | null) => {
    const next = current === null ? 'blue' : current === 'blue' ? 'green' : null
    const received = next !== null
    onChange(lineItems.map(item => item.id === id ? { ...item, highlight_color: next, received } : item))
    await supabase.from('line_items').update({ highlight_color: next, received }).eq('id', id)
  }, [lineItems, onChange, supabase])

  const handleFabricSelect = useCallback(async (lineItemId: string, fabric: {
    design: string | null; collection: string | null; colour: string | null
    sku: string | null; brand: string | null; product_id: string | null
    price_zar: number | null; image_url: string | null; useable_width_cm?: number | null
  }) => {
    const description = [fabric.brand, fabric.collection]
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
      fabric_width_cm: fabric.useable_width_cm ?? null,
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


  const toggleLink = useCallback(async (id: string, currentParentId: string | null) => {
    if (currentParentId) {
      // Unlink: clear parent and remove indent
      onChange(lineItems.map(item => item.id === id ? { ...item, parent_item_id: null, indent_level: 0 } : item))
      const { error } = await supabase.from('line_items').update({ parent_item_id: null, indent_level: 0 }).eq('id', id)
      if (error) {
        toast.error('Failed to unlink item')
        onChange(lineItems.map(item => item.id === id ? { ...item, parent_item_id: currentParentId, indent_level: item.indent_level } : item))
      }
    } else {
      // Link: find nearest non-linked item above by sort_order
      const thisItem = lineItems.find(i => i.id === id)
      if (!thisItem) return
      const above = [...lineItems]
        .filter(i => i.sort_order < thisItem.sort_order && i.row_type === 'item' && !i.parent_item_id)
        .sort((a, b) => b.sort_order - a.sort_order)[0]
      if (!above) return
      onChange(lineItems.map(item => item.id === id ? { ...item, parent_item_id: above.id, indent_level: 1 } : item))
      const { error } = await supabase.from('line_items').update({ parent_item_id: above.id, indent_level: 1 }).eq('id', id)
      if (error) {
        toast.error('Failed to link item')
        onChange(lineItems.map(item => item.id === id ? { ...item, parent_item_id: null, indent_level: 0 } : item))
      }
    }
  }, [lineItems, onChange, supabase])

  const deleteRow = useCallback(async (id: string) => {
    await supabase.from('line_items').delete().eq('id', id)
    const renumbered = lineItems.filter(item => item.id !== id).map((item, i) => ({ ...item, sort_order: i }))
    onChange(renumbered)
    const { error: reorderError } = await supabase.from('line_items')
      .upsert(renumbered.map(item => ({ id: item.id, project_id: projectId, sort_order: item.sort_order })), { onConflict: 'id' })
    if (reorderError) {
      toast.error('Failed to renumber remaining rows — please refresh')
    }
  }, [lineItems, onChange, supabase, projectId])

  const handleDragEnd = useCallback(async () => {
    if (dragItem.current === null || dragOver.current === null) return
    const reordered = [...lineItems]
    const [moved] = reordered.splice(dragItem.current, 1)
    reordered.splice(dragOver.current, 0, moved)
    const updated = reordered.map((item, i) => ({ ...item, sort_order: i }))
    onChange(updated)
    dragItem.current = null
    dragOver.current = null
    const { error: reorderError } = await supabase.from('line_items')
      .upsert(updated.map(item => ({ id: item.id, project_id: projectId, sort_order: item.sort_order })), { onConflict: 'id' })
    if (reorderError) {
      toast.error('Failed to save new order — please refresh')
    }
  }, [lineItems, onChange, supabase, projectId])

  const itemCount = lineItems.filter(i => i.row_type === 'item').length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider">Line Items</h2>
        <span className="text-xs text-[#8A877F]">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-[#FDFCFB] rounded-xl overflow-x-auto overflow-y-visible shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_24px_rgba(0,0,0,0.06)]">
        <table className="w-full text-sm min-w-[1120px]">
          <thead>
            <tr className="border-b border-[#E8E4DC] bg-[#F7F4EF] text-xs text-[#8A877F] uppercase tracking-wider">
              <th className="w-6 px-2 py-2 sticky left-0 z-10 bg-[#F7F4EF]" />
              <th className="w-7 px-2 py-2 sticky left-6 z-10 bg-[#F7F4EF]" title="Received" />
              <th className="text-left px-2 py-2 w-[200px] min-w-[200px] sticky left-[52px] z-10 bg-[#F7F4EF] border-r border-[#E8E4DC]">Item</th>
              <th className="text-left px-2 py-2 min-w-[160px] border-r border-[#EDEBE6]">Description</th>
              <th className="text-right px-2 py-2 min-w-[105px] whitespace-nowrap">Qty / Unit</th>
              <th className="text-left px-2 py-2 min-w-[120px]">Supplier</th>
              <th className="text-left px-2 py-2 min-w-[120px] whitespace-nowrap">Deliver To</th>
              <th className="text-right px-1 py-2 min-w-[52px] whitespace-nowrap border-r border-[#EDEBE6]">Lead</th>
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
                    className="border-b border-[#E0DDD6] bg-[#F5F2EC] group"
                  >
                    <td className={`px-1.5 py-2 text-[#C4BFB5] sticky left-0 z-10 bg-[#F5F2EC] border-l-[3px] border-transparent ${!locked ? 'group-hover:text-[#8A877F]' : ''}`}>
                      {!locked && (
                        <div className="relative flex items-center justify-center w-[14px] h-[14px]">
                          <GripVertical size={14} className="group-hover:opacity-0 transition-opacity cursor-grab active:cursor-grabbing" />
                          <button
                            onClick={e => { e.stopPropagation(); insertRowBefore(index) }}
                            title="Insert row below"
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[#9A7B4F] hover:text-[#7A5B2F] cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="w-7 sticky left-6 z-10 bg-[#F5F2EC]" />
                    <td colSpan={12} className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-0.5 h-4 bg-[#9A7B4F] rounded-full flex-shrink-0" />
                        <input
                          value={item.item_name}
                          onChange={e => updateLocal(item.id, 'item_name', e.target.value)}
                          onBlur={e => saveField(item.id, 'item_name', e.target.value)}
                          readOnly={locked}
                          ref={(el) => { if (el && newlyAddedId === item.id) el.focus({ preventScroll: true }) }}
                          onFocus={() => { if (newlyAddedId === item.id) setNewlyAddedId(null) }}
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
              const isLinked = !!item.parent_item_id
              const isParent = lineItems.some(i => i.parent_item_id === item.id)

              return (
                <tr
                  key={item.id}
                  draggable={!locked}
                  onDragStart={!locked ? () => { dragItem.current = index } : undefined}
                  onDragEnter={!locked ? () => { dragOver.current = index } : undefined}
                  onDragEnd={!locked ? handleDragEnd : undefined}
                  onDragOver={!locked ? e => e.preventDefault() : undefined}
                  className={`border-b border-[#F2EFE9] last:border-0 group transition-colors ${item.highlight_color === 'blue' ? 'bg-blue-50 hover:bg-blue-50' : item.highlight_color === 'green' ? 'bg-green-50 hover:bg-green-50' : 'hover:bg-[#FDFCF9]'}`}
                >
                  {/* Drag handle */}
                  <td className={`px-1.5 py-1 sticky left-0 z-10 text-[#D8D3C8] ${item.highlight_color === 'blue' ? 'bg-blue-50' : item.highlight_color === 'green' ? 'bg-green-50' : 'bg-[#FDFCFB]'} ${isLinked ? 'border-l-[3px] border-[#9A7B4F]' : isParent ? 'border-l-[3px] border-[#9A7B4F]/40' : 'border-l-[3px] border-transparent'} ${!locked ? 'group-hover:text-[#8A877F]' : ''}`}>
                    {!locked && (
                      <div className="relative flex items-center justify-center w-[14px] h-[14px]">
                        <GripVertical size={14} className="group-hover:opacity-0 transition-opacity cursor-grab active:cursor-grabbing" />
                        <button
                          onClick={e => { e.stopPropagation(); insertRowBefore(index) }}
                          title="Insert row below"
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[#9A7B4F] hover:text-[#7A5B2F] cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Received checkbox */}
                  <td className={`px-1.5 py-1 sticky left-6 z-10 ${item.highlight_color === 'blue' ? 'bg-blue-50' : item.highlight_color === 'green' ? 'bg-green-50' : 'bg-[#FDFCFB]'}`}>
                    <button
                      onClick={() => cycleHighlight(item.id, item.highlight_color)}
                      title={item.highlight_color === 'blue' ? 'Mark as not received' : 'Mark as received'}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer flex-shrink-0
                        ${item.highlight_color === 'blue'
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : item.highlight_color === 'green'
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-[#D8D3C8] hover:border-blue-400 opacity-0 group-hover:opacity-100'
                        }`}
                    >
                      {item.highlight_color && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </td>

                  {/* Item name — with link toggle + dimensions/colour */}
                  <td className={COL + ` w-[200px] min-w-[200px] sticky left-[52px] z-10 border-r border-[#E8E4DC] ${item.highlight_color === 'blue' ? 'bg-blue-50' : item.highlight_color === 'green' ? 'bg-green-50' : 'bg-[#FDFCFB]'}`}>
                    <div className={isLinked ? 'pl-4' : ''}>
                      <div className="flex items-center gap-1">
                        {isLinked && (
                          <CornerDownRight size={11} className="text-[#9A7B4F] flex-shrink-0 -mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          {(() => {
                            const supplier = suppliers.find(s => s.id === item.supplier_id)
                            const hasAccess = supplier?.is_platform && supplier.price_list_id ? activePriceListIds.includes(supplier.price_list_id) : false
                            if (supplier?.is_platform && !hasAccess) return (
                              <Link href="/price-lists" className="text-xs text-amber-600 italic underline hover:text-amber-700">
                                Request price list access
                              </Link>
                            )
                            // Platform supplier with access, or an org supplier linked to one of the org's own price lists
                            if (supplier?.price_list_id && (!supplier.is_platform || hasAccess)) return (
                              <FabricSearch
                                value={item.item_name}
                                onChange={v => updateLocal(item.id, 'item_name', v)}
                                onBlur={v => saveField(item.id, 'item_name', v)}
                                onSelect={fabric => handleFabricSelect(item.id, fabric)}
                                placeholder="Search fabric…"
                                className={INPUT}
                                priceListId={supplier.price_list_id}
                              />
                            )
                            return (
                              <AutoTextarea
                                value={item.item_name}
                                onChange={v => updateLocal(item.id, 'item_name', v)}
                                onBlur={v => { saveField(item.id, 'item_name', v); if (newlyAddedId === item.id) setNewlyAddedId(null) }}
                                placeholder="Item name"
                                className={INPUT}
                                readOnly={locked}
                                autoFocus={newlyAddedId === item.id}
                              />
                            )
                          })()}
                        </div>
                        {/* Image thumbnail / add button — sits AFTER the name so the
                            name's position never shifts, image or no image. */}
                        {imagesEnabled && (() => {
                          // Designer upload wins; catalogue image (Twinbru / price list) is the fallback
                          const thumb = item.image_urls?.[0] ?? item.fabric_image_url ?? null
                          const count = item.image_urls?.length ?? 0
                          return (
                            <button
                              onClick={() => setImageModal({ lineItemId: item.id, itemName: item.item_name })}
                              title={thumb ? `Images for ${item.item_name || 'this item'}` : 'Add an image'}
                              aria-label={thumb ? `Images for ${item.item_name || 'this item'}` : 'Add an image'}
                              className={`relative flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center overflow-hidden transition-colors cursor-pointer
                                ${thumb
                                  ? 'border-[#D8D3C8] hover:border-[#9A7B4F]'
                                  : 'border-transparent text-[#C4BFB5] opacity-0 group-hover:opacity-100 hover:text-[#9A7B4F] hover:border-[#D8D3C8]'
                                }`}
                            >
                              {thumb
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                                : <ImagePlus size={11} />
                              }
                              {count > 1 && (
                                <span className="absolute bottom-0 right-0 px-0.5 bg-black/60 text-white text-[8px] leading-tight rounded-tl">{count}</span>
                              )}
                            </button>
                          )
                        })()}
                        {item.twinbru_product_id && (
                          <input
                            value={item.colour_finish ?? ''}
                            onChange={e => updateLocal(item.id, 'colour_finish', e.target.value)}
                            onBlur={e => saveField(item.id, 'colour_finish', e.target.value)}
                            placeholder="Colour…"
                            readOnly={locked}
                            className="w-20 bg-transparent outline-none text-xs text-[#8A877F] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#D8D3C8]"
                          />
                        )}
                        {!locked && (() => {
                          const parent = isLinked ? lineItems.find(i => i.id === item.parent_item_id) : null
                          const parentSection = parent ? sectionNameById.get(parent.id) : null
                          const ownSection = sectionNameById.get(item.id)
                          const crossSection = isLinked && !!parent && parentSection !== ownSection
                          const linkTitle = isLinked
                            ? `Linked to: '${parent?.item_name || 'item'}'${crossSection && parentSection ? ` — ${parentSection}` : ''}`
                            : 'Link to item above'
                          return (
                            <div className="relative group/link flex-shrink-0">
                              <button
                                onClick={() => toggleLink(item.id, item.parent_item_id ?? null)}
                                className={`p-0.5 rounded transition-colors cursor-pointer
                                  ${isLinked
                                    ? crossSection ? 'text-amber-500' : 'text-[#9A7B4F]'
                                    : 'text-[#A8A39B] opacity-0 group-hover:opacity-100 hover:text-[#9A7B4F]'
                                  }`}
                              >
                                {isLinked ? <Unlink2 size={14} strokeWidth={2.5} /> : <Link2 size={14} strokeWidth={2.5} />}
                              </button>
                              {/* Custom tooltip — appears instantly on hover, no native browser delay */}
                              <div className="pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 z-30 opacity-0 group-hover/link:opacity-100 whitespace-nowrap rounded bg-[#2C2C2A] px-2 py-1 text-[10px] text-white shadow-lg">
                                {linkTitle}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                      {!item.twinbru_product_id && (
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
                      )}
                      {item.twinbru_product_id && (() => {
                        const w = widthMap[item.twinbru_product_id] ?? item.fabric_width_cm
                        const s = !depositReceived ? stockMap[item.id] : null
                        const transitDays = s?.transitDate ? Math.ceil((new Date(s.transitDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
                        const transitIsNextDay = transitDays != null && transitDays <= 1
                        const localQty = ((s?.localQty ?? 0) + (transitIsNextDay && s?.transitQty ? s.transitQty : 0))
                        const showLocal = localQty > 0
                        const showTransit = s?.transitQty != null && s?.transitDate && !transitIsNextDay
                        const showLead = s && !showLocal && !showTransit && !!s.maxLeadTimeDate
                        const rollPricePerM = item.twinbru_cost_price != null ? Math.round(item.twinbru_cost_price * 0.9 * 100) / 100 : 0
                        const isRoll = item.twinbru_cost_price != null && Math.abs(item.cost_price - rollPricePerM) < 0.001 && item.cost_price !== item.twinbru_cost_price
                        const setMode = async (roll: boolean) => {
                          const cost_price = roll ? rollPricePerM : item.twinbru_cost_price!
                          onChange(lineItems.map(i => i.id === item.id ? { ...i, cost_price, unit: 'm' } : i))
                          await supabase.from('line_items').update({ cost_price, unit: 'm' }).eq('id', item.id)
                        }
                        const showCutRoll = item.twinbru_cost_price != null && !locked
                        if (!w && !s && !showCutRoll) return null
                        return (
                          <div className="flex flex-row flex-wrap items-center gap-1 mt-1">
                            {w ? <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[#EDE9E1] text-[#8A877F]">{w}cm wide</span> : null}
                            {showLocal && (
                              <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{localQty.toLocaleString()}m — in stock</span>
                            )}
                            {showTransit && (
                              <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{s!.transitQty!.toLocaleString()}m — in transit (~{Math.ceil((new Date(s!.transitDate!).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))}w)</span>
                            )}
                            {showLead && (
                              <span className="inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">~{Math.max(1, Math.ceil((new Date(s!.maxLeadTimeDate!).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))}w lead time</span>
                            )}
                            {showCutRoll && (
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => setMode(false)}
                                  title="Standard cut price per metre"
                                  className={`text-[9px] px-1.5 py-0.5 rounded-l-full border transition-colors cursor-pointer ${!isRoll ? 'bg-[#9A7B4F] border-[#9A7B4F] text-white' : 'bg-white border-[#D8D3C8] text-[#8A877F] hover:border-[#9A7B4F]'}`}
                                >Cut</button>
                                <button
                                  onClick={() => setMode(true)}
                                  title="Roll price per metre (10% off)"
                                  className={`text-[9px] px-1.5 py-0.5 rounded-r-full border transition-colors cursor-pointer ${isRoll ? 'bg-[#9A7B4F] border-[#9A7B4F] text-white' : 'bg-white border-[#D8D3C8] text-[#8A877F] hover:border-[#9A7B4F]'}`}
                                >Roll</button>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </td>

                  {/* Description */}
                  <td className={COL + ' align-top pr-4 border-r border-[#EDEBE6]'}>
                    <AutoTextarea
                      value={item.description ?? ''}
                      onChange={v => updateLocal(item.id, 'description', v)}
                      onFocus={locked ? () => { lockedDescFocusRef.current = { id: item.id, value: item.description ?? '' } } : undefined}
                      onBlur={v => saveField(item.id, 'description', v, locked ? (lockedDescFocusRef.current?.id === item.id ? lockedDescFocusRef.current.value : undefined) : undefined)}
                      placeholder="Description"
                      className={INPUT}
                    />
                    {!locked && item.twinbru_product_id && (
                      <div className="relative mt-0.5">
                        {dropsOpen === item.id ? (
                          <div className="bg-white border border-[#D8D3C8] rounded-lg p-2 shadow-sm">
                            <div className="flex items-center gap-1 mb-1.5">
                              <input
                                type="text" inputMode="decimal"
                                value={dropsForm.drops}
                                onChange={e => setDropsForm(f => ({ ...f, drops: e.target.value }))}
                                placeholder="Drops"
                                className="w-14 text-xs bg-[#F5F2EC] border border-[#D8D3C8] rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#9A7B4F]"
                              />
                              <span className="text-[10px] text-[#8A877F]">×</span>
                              <input
                                type="text" inputMode="decimal"
                                value={dropsForm.height}
                                onChange={e => setDropsForm(f => ({ ...f, height: e.target.value }))}
                                placeholder="Height m"
                                className="w-16 text-xs bg-[#F5F2EC] border border-[#D8D3C8] rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-[#9A7B4F]"
                              />
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  const text = `${dropsForm.drops} drops × ${dropsForm.height}m`
                                  const current = item.description ?? ''
                                  const updated = current ? `${current}\n${text}` : text
                                  updateLocal(item.id, 'description', updated)
                                  saveField(item.id, 'description', updated)
                                  setDropsOpen(null)
                                  setDropsForm({ drops: '', height: '' })
                                }}
                                className="text-[10px] px-2 py-0.5 bg-[#9A7B4F] text-white rounded cursor-pointer hover:bg-[#7d6340] transition-colors"
                              >Add</button>
                              <button
                                onClick={() => { setDropsOpen(null); setDropsForm({ drops: '', height: '' }) }}
                                className="text-[10px] px-2 py-0.5 text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
                              >Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDropsOpen(item.id)}
                            className="text-[9px] text-[#C4BFB5] hover:text-[#9A7B4F] transition-colors cursor-pointer"
                          >+ drops</button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Qty + Unit */}
                  <td className={COL}>
                    <div className="flex items-center gap-1">
                      <input
                        type="text" inputMode="decimal"
                        value={item.quantity}
                        onChange={e => { const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'); updateLocal(item.id, 'quantity', v as unknown as number) }}
                        onFocus={e => { if (parseFloat(e.target.value) === 0) { updateLocal(item.id, 'quantity', '' as unknown as number) } }}
                        onBlur={e => { const v = parseFloat(e.target.value.replace(',', '.')) || 1; saveField(item.id, 'quantity', v) }}
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
                        className="w-10 bg-transparent outline-none text-xs text-[#8A877F] focus:bg-white focus:ring-1 focus:ring-[#9A7B4F] rounded px-1 py-0.5 placeholder-[#C4BFB5]"
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
                          onCreate={name => createSupplierForItem(item.id, name)}
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
                            ...(officeAddress.address ? [{ id: `${officeAddress.name}\n${officeAddress.address}`, label: officeAddress.name }] : []),
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
                                  if (sup) setAddDeliveryModal({ supplierId, supplierName: sup.supplier_name, lineItemId: item.id, address: '', contactName: sup.delivery_contact_name ?? '', contactNumber: sup.delivery_contact_number ?? '' })
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
                  <td className={COL.replace('px-2', 'px-1') + ' border-r border-[#EDEBE6]'}>
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
                        <span className="text-xs text-[#8A877F] flex-shrink-0">d</span>
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
                        <span className="text-xs text-[#8A877F] flex-shrink-0">w</span>
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
                            onBlur={v => handleCostChange(item.id, v)}
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
                          {!locked && item.sale_price_override !== null && (
                            discountOpen === item.id ? (
                              <div className="flex items-center gap-1 mt-0.5 justify-end">
                                <input
                                  type="text" inputMode="decimal" autoFocus
                                  value={discountValue}
                                  onChange={e => setDiscountValue(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                                  onFocus={e => e.target.select()}
                                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                  onBlur={() => {
                                    const pct = parseFloat(discountValue)
                                    if (!isNaN(pct)) applyCostDiscount(item.id, pct)
                                    setDiscountOpen(null)
                                    setDiscountValue('')
                                  }}
                                  placeholder="0"
                                  className="w-10 text-xs bg-[#F5F2EC] border border-[#D8D3C8] rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-[#9A7B4F] text-right"
                                />
                                <span className="text-[9px] text-[#8A877F] whitespace-nowrap">% off sale</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setDiscountOpen(item.id); setDiscountValue('') }}
                                className="block ml-auto text-[9px] text-[#C4BFB5] hover:text-[#9A7B4F] transition-colors cursor-pointer mt-0.5"
                              >% off sale…</button>
                            )
                          )}
                        </div>
                      )
                    })()}
                  </td>

                  {/* Markup % */}
                  <td className={COL}>
                    <input
                      type="text" inputMode="decimal"
                      value={item.sale_price_override !== null && item.cost_price <= 0 ? '' : item.markup_percentage}
                      onChange={e => { const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'); updateLocal(item.id, 'markup_percentage', v as unknown as number) }}
                      onFocus={e => { if (parseFloat(e.target.value) === 0) { updateLocal(item.id, 'markup_percentage', '' as unknown as number) } }}
                      onBlur={e => { const v = parseFloat(e.target.value.replace(',', '.')) || 0; saveField(item.id, 'markup_percentage', v) }}
                      readOnly={locked}
                      className={NUM_INPUT}
                    />
                  </td>

                  {/* Sale Price — editable override */}
                  <td className={COL}>
                    {locked ? (
                      <span className="block text-right text-sm tabular-nums text-[#2C2C2A] font-medium whitespace-nowrap">{formatZAR(c.sale_price)}</span>
                    ) : (
                      <div className="relative">
                        <CurrencyInput
                          value={c.sale_price}
                          onChange={v => updateLocal(item.id, 'sale_price_override', v)}
                          onBlur={v => {
                            const impliedMarkup = item.cost_price > 0
                              ? Math.round((v / item.cost_price - 1) * 10000) / 100
                              : 0
                            onChange(lineItems.map(li =>
                              li.id === item.id ? { ...li, sale_price_override: v, markup_percentage: impliedMarkup } : li
                            ))
                            saveField(item.id, 'sale_price_override', v)
                            saveField(item.id, 'markup_percentage', impliedMarkup)
                          }}
                          className={NUM_INPUT}
                        />
                        {item.sale_price_override !== null && (
                          <button
                            title="Clear override — revert to markup-computed price"
                            onClick={() => { updateLocal(item.id, 'sale_price_override', null); saveField(item.id, 'sale_price_override', null) }}
                            className="absolute -top-1.5 -right-1 flex items-center gap-0.5 text-amber-500 hover:text-amber-700 cursor-pointer"
                          >
                            <span className="text-[9px] font-semibold leading-none">override ×</span>
                          </button>
                        )}
                      </div>
                    )}
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
            onClick={addSection}
            className="flex items-center gap-1.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
          >
            <LayoutList size={14} /> Add room / section
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-[#9A7B4F] hover:text-[#7d6340] transition-colors cursor-pointer"
          >
            <Plus size={14} /> Add item
          </button>
        </div>
      )}
      {!locked && (
        <>
          <p className="mt-2 text-xs text-[#9A7B4F]/80 leading-relaxed">
            To search for fabrics and pull in live pricing, select a supplier with a linked price list in the Supplier column first — the Item field will then become a live product search. Link your own price lists to suppliers under Price Lists.
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

      {/* New supplier mini-form modal */}
      {newSupplierModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={() => setNewSupplierModal(null)}>
          <div className="bg-white rounded-lg shadow-xl w-[400px] p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#2C2C2A] mb-1">Add supplier</h3>
            <p className="text-xs text-[#8A877F] mb-4">Add their email so you can send them a price request directly from the project.</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-[#8A877F] block mb-1">Supplier name</label>
                <input
                  type="text"
                  value={newSupplierModal.name}
                  onChange={e => setNewSupplierModal(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-2.5 py-1.5 text-sm border border-[#D8D3C8] rounded-lg focus:outline-none focus:border-[#9A7B4F]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8A877F] block mb-1">Email <span className="text-[#C4BFB5]">(for price requests)</span></label>
                <input
                  autoFocus
                  type="email"
                  placeholder="supplier@example.com"
                  value={newSupplierModal.email}
                  onChange={e => setNewSupplierModal(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="w-full px-2.5 py-1.5 text-sm border border-[#D8D3C8] rounded-lg focus:outline-none focus:border-[#9A7B4F]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8A877F] block mb-1">Default markup %</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={newSupplierModal.markup}
                  onChange={e => setNewSupplierModal(prev => prev ? { ...prev, markup: e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.') } : null)}
                  className="w-full px-2.5 py-1.5 text-sm border border-[#D8D3C8] rounded-lg focus:outline-none focus:border-[#9A7B4F]"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setNewSupplierModal(null)}
                className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={!newSupplierModal.name.trim()}
                onClick={async () => {
                  const { name, email, markup, lineItemId } = newSupplierModal
                  const { data: { user } } = await supabase.auth.getUser()
                  const { data: orgId } = await supabase.rpc('get_current_org_id')
                  const { data, error } = await supabase.from('suppliers').insert({
                    user_id: user!.id,
                    org_id: orgId,
                    supplier_name: name.trim(),
                    email: email.trim() || null,
                    markup_percentage: parseFloat(markup) || 0,
                  }).select().single()
                  if (error) { toast.error('Failed to create supplier'); return }
                  toast.success(`Supplier "${name.trim()}" created`)
                  const newSupplier = { id: data.id, supplier_name: data.supplier_name, markup_percentage: data.markup_percentage, delivery_address: data.delivery_address ?? null, delivery_contact_name: null, delivery_contact_number: null, is_platform: false, price_list_id: null, email: data.email ?? null }
                  onSupplierCreated(newSupplier)
                  setNewSupplierModal(null)
                  // Select the new supplier on the line item that triggered this
                  handleSupplierChange(lineItemId, data.id, data.supplier_name)
                }}
                className="px-4 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Add Supplier
              </button>
            </div>
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
              className="w-full px-3 py-2 text-sm border border-[#D8D3C8] rounded-lg focus:outline-none focus:border-[#9A7B4F] mb-3 resize-none leading-relaxed"
            />
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="text-xs text-[#8A877F] block mb-1">Contact name at delivery</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={addDeliveryModal.contactName}
                  onChange={e => setAddDeliveryModal(prev => prev ? { ...prev, contactName: e.target.value } : null)}
                  className="w-full px-2.5 py-1.5 text-sm border border-[#D8D3C8] rounded-lg focus:outline-none focus:border-[#9A7B4F]"
                />
              </div>
              <div>
                <label className="text-xs text-[#8A877F] block mb-1">Their contact number</label>
                <input
                  type="text"
                  placeholder="082 000 0000"
                  value={addDeliveryModal.contactNumber}
                  onChange={e => setAddDeliveryModal(prev => prev ? { ...prev, contactNumber: e.target.value } : null)}
                  className="w-full px-2.5 py-1.5 text-sm border border-[#D8D3C8] rounded-lg focus:outline-none focus:border-[#9A7B4F]"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAddDeliveryModal(null)} className="px-4 py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                Cancel
              </button>
              <button
                disabled={!addDeliveryModal.address.trim()}
                onClick={async () => {
                  const { supplierId, supplierName, lineItemId, address, contactName, contactNumber } = addDeliveryModal
                  const trimmed = address.trim()
                  const combined = `${supplierName}\n${trimmed}`
                  setAddDeliveryModal(null)
                  // Save to supplier record (address + contact fields)
                  await fetch(`/api/suppliers/${supplierId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ delivery_address: trimmed, delivery_contact_name: contactName || null, delivery_contact_number: contactNumber || null }),
                  })
                  // Update local supplier so future reads are consistent
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

      {/* Line item images modal */}
      {imageModal && (() => {
        const item = lineItems.find(i => i.id === imageModal.lineItemId)
        const uploaded = item?.image_urls ?? []
        const catalogue = item?.fabric_image_url ?? null
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setImageModal(null)}>
            <div className="bg-white rounded-lg shadow-xl w-[480px] p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-base font-semibold text-[#2C2C2A]">
                  Images — {imageModal.itemName || 'Untitled item'}
                </h3>
                <button onClick={() => setImageModal(null)} aria-label="Close" className="text-[#A8A39B] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs text-[#8A877F] mb-4">
                The first image appears next to this item on the quote and invoice.
              </p>

              {uploaded.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {uploaded.map((url, i) => (
                    <div key={url} className="relative group/img aspect-square rounded-lg overflow-hidden border border-[#E8E4DC]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[9px] rounded">On quote</span>
                      )}
                      {!locked && (
                        <button
                          onClick={() => deleteLineItemImage(imageModal.lineItemId, url)}
                          aria-label={`Remove image ${i + 1}`}
                          className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover/img:opacity-100 hover:bg-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {uploaded.length === 0 && catalogue && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-[#FAF8F5] border border-[#E8E4DC] rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={catalogue} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                  <p className="text-xs text-[#8A877F]">
                    Using the supplier&apos;s catalogue image. Upload your own to replace it on the quote.
                  </p>
                </div>
              )}

              {uploaded.length === 0 && !catalogue && (
                <p className="text-xs text-[#A8A39B] mb-4">No images on this item yet.</p>
              )}

              {!locked && (
                <>
                  <input
                    ref={imageFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    multiple
                    className="hidden"
                    onChange={e => { uploadLineItemImages(imageModal.lineItemId, e.target.files); e.target.value = '' }}
                  />
                  <button
                    onClick={() => imageFileRef.current?.click()}
                    disabled={uploadingImages || uploaded.length >= 6}
                    className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#D8D3C8] rounded-lg text-sm text-[#8A877F] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingImages ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingImages ? 'Uploading…' : uploaded.length >= 6 ? 'Maximum 6 images' : 'Upload images'}
                  </button>
                  <p className="text-xs text-[#A8A39B] mt-2">JPG, PNG, WebP or SVG — up to 5 MB each, 6 per item. Images are compressed automatically.</p>
                </>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
