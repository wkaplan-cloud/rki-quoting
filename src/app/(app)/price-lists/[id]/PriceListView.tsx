'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ImageOff, Plus, Pencil, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useNow } from '@/lib/useNow'

interface PriceListItem {
  id: string
  brand: string | null
  collection: string | null
  design: string | null
  colour: string | null
  sku: string | null
  product_id: string | null
  price_zar: number | null
  image_url: string | null
  useable_width_cm: number | null
}

interface StockInfo {
  localQty: number | null
  transitQty: number | null
  transitDate: string | null
  maxLeadTimeDate: string | null
  weeksUntilAvailable: number | null
}

function StockBadge({ productId }: { productId: string }) {
  const now = useNow()
  const [stock, setStock] = useState<StockInfo | null>(null)

  useEffect(() => {
    fetch(`/api/fabric-stock?productId=${productId}`)
      .then(r => r.json())
      .then(d => { if (d.weeksUntilAvailable !== undefined) setStock(d) })
      .catch(() => {})
  }, [productId])

  if (!stock) return null

  const transitDays = stock.transitDate
    ? Math.ceil((new Date(stock.transitDate).getTime() - now) / (24 * 60 * 60 * 1000))
    : null
  const transitIsNextDay = transitDays != null && transitDays <= 1
  const localQty = (stock.localQty ?? 0) + (transitIsNextDay && stock.transitQty ? stock.transitQty : 0)
  const showLocal = localQty > 0
  const showTransit = stock.transitQty != null && stock.transitDate && !transitIsNextDay

  return (
    <div className="flex flex-col gap-0.5">
      {showLocal && (
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{localQty.toLocaleString()}m — in stock</span>
      )}
      {showTransit && (
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
          {stock.transitQty!.toLocaleString()}m — in transit (~{Math.ceil((new Date(stock.transitDate!).getTime() - now) / (7 * 24 * 60 * 60 * 1000))}w)
        </span>
      )}
      {!showLocal && !showTransit && stock.maxLeadTimeDate && (
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
          ~{Math.max(1, Math.ceil((new Date(stock.maxLeadTimeDate).getTime() - now) / (7 * 24 * 60 * 60 * 1000)))}w lead time
        </span>
      )}
    </div>
  )
}

function formatPrice(n: number | null) {
  if (n == null) return '–'
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ItemImage({ url, alt }: { url: string | null; alt: string }) {
  const [errored, setErrored] = useState(false)
  if (!url || errored) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#EDE9E1]">
        <ImageOff size={20} className="text-[#C4A46B] opacity-50" />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="w-full h-full object-cover" onError={() => setErrored(true)} />
  )
}

interface ItemForm {
  brand: string
  collection: string
  design: string
  colour: string
  sku: string
  product_id: string
  price_zar: string
  image_url: string
}

const EMPTY_FORM: ItemForm = { brand: '', collection: '', design: '', colour: '', sku: '', product_id: '', price_zar: '', image_url: '' }

function toForm(item: PriceListItem): ItemForm {
  return {
    brand: item.brand ?? '',
    collection: item.collection ?? '',
    design: item.design ?? '',
    colour: item.colour ?? '',
    sku: item.sku ?? '',
    product_id: item.product_id ?? '',
    price_zar: item.price_zar != null ? String(item.price_zar) : '',
    image_url: item.image_url ?? '',
  }
}

function ItemModal({ priceListId, item, onClose, onSaved }: { priceListId: string; item: PriceListItem | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ItemForm>(item ? toForm(item) : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof ItemForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSave() {
    if (!form.design.trim() && !form.sku.trim()) {
      setError('Enter at least a Design name or SKU.')
      return
    }
    if (form.price_zar.trim() && isNaN(parseFloat(form.price_zar))) {
      setError('Price must be a number.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = item
        ? await fetch(`/api/price-lists/${priceListId}/items`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: item.id, ...form }),
          })
        : await fetch(`/api/price-lists/${priceListId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: [form], recount: true }),
          })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/price-lists/${priceListId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8D3C8]">
          <h2 className="font-serif text-lg font-medium text-[#1A1A18]">{item ? 'Edit Item' : 'Add Item'}</h2>
          <button onClick={onClose} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Brand" placeholder="e.g. Hertex" value={form.brand} onChange={set('brand')} />
            <Input label="Collection" placeholder="e.g. Spring 2026" value={form.collection} onChange={set('collection')} />
            <Input label="Design" placeholder="e.g. Linen Weave" value={form.design} onChange={set('design')} />
            <Input label="Colour" placeholder="e.g. Natural" value={form.colour} onChange={set('colour')} />
            <Input label="SKU" placeholder="e.g. LW-001" value={form.sku} onChange={set('sku')} />
            <Input label="Price (ZAR)" placeholder="e.g. 450.00" value={form.price_zar} onChange={set('price_zar')} />
          </div>
          <Input label="Image URL" placeholder="https://…" value={form.image_url} onChange={set('image_url')} />

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#D8D3C8] flex items-center justify-between gap-2">
          <div>
            {item && (confirmDelete ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-[#8A877F]">Delete this item?</span>
                <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes'}</Button>
                <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>No</Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-red-600">
                Delete
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PriceListView({ priceListId, canEdit = false, isGlobal = true }: { priceListId: string; canEdit?: boolean; isGlobal?: boolean }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<PriceListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState<'new' | PriceListItem | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Global lists (16k+ items) are search-first; org lists also browse without a search term
  const browseWhenEmpty = !isGlobal

  const fetchItems = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/price-lists/${priceListId}/items?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setItems(res.ok && Array.isArray(data) ? data : [])
    } catch {
      setItems([])
    }
    setLoading(false)
  }, [priceListId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = search.trim()

    if (q.length < 2 && !browseWhenEmpty) {
      // Drives a timer; synchronising with an external system is what an effect is for.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([])
      return
    }

    debounceRef.current = setTimeout(() => fetchItems(q.length < 2 ? '' : q), q ? 300 : 0)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, browseWhenEmpty, fetchItems])

  function handleSaved() {
    setModal(null)
    fetchItems(search.trim().length < 2 ? '' : search.trim())
    router.refresh()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search bar */}
      <div className="px-8 py-4 border-b border-[#D8D3C8] bg-[#F5F2EC] flex items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A877F]" />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border border-[#9A7B4F] border-t-transparent rounded-full animate-spin" />
          )}
          <input
            type="text"
            placeholder="Search design, colour, brand, SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            className="w-full pl-8 pr-8 py-2 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] placeholder-[#8A877F] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors"
          />
        </div>
        {items.length > 0 && (
          <span className="text-xs text-[#8A877F]">{items.length === 60 ? '60+ results' : `${items.length} result${items.length !== 1 ? 's' : ''}`}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {isGlobal && <span className="text-xs text-[#8A877F]">Local fabrics only — imported fabrics and wallpaper are not listed</span>}
          {canEdit && (
            <Button size="sm" onClick={() => setModal('new')}>
              <Plus size={13} /> Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-8">
        {search.trim().length < 2 && !browseWhenEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search size={28} className="text-[#C4A46B] opacity-40 mb-3" />
            <p className="text-sm font-medium text-[#2C2C2A]">Search to find fabrics</p>
            <p className="text-xs text-[#8A877F] mt-1">Type a design name, colour, brand or SKU</p>
            {isGlobal && <p className="text-xs text-[#8A877F] mt-3 max-w-xs">Local fabrics only — imported fabrics and wallpaper are not listed</p>}
          </div>
        ) : items.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {search.trim() ? (
              <p className="text-sm text-[#8A877F]">No items found for &ldquo;{search}&rdquo;</p>
            ) : (
              <>
                <p className="text-sm font-medium text-[#2C2C2A]">No items yet</p>
                {canEdit && <p className="text-xs text-[#8A877F] mt-1">Add items with the button above</p>}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map(item => (
              <div key={item.id} className="relative group bg-white border border-[#D8D3C8] rounded-lg overflow-hidden hover:border-[#C4A46B] transition-colors">
                {canEdit && (
                  <button
                    onClick={() => setModal(item)}
                    className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 border border-[#D8D3C8] text-[#8A877F] opacity-0 group-hover:opacity-100 hover:text-[#2C2C2A] hover:border-[#9A7B4F] focus-visible:opacity-100 transition-opacity cursor-pointer"
                    aria-label={`Edit ${[item.design, item.colour].filter(Boolean).join(' ') || 'item'}`}
                  >
                    <Pencil size={12} />
                  </button>
                )}
                <div className="aspect-square overflow-hidden bg-[#EDE9E1]">
                  <ItemImage url={item.image_url} alt={[item.design, item.colour].filter(Boolean).join(' ')} />
                </div>
                <div className="p-2.5 space-y-1">
                  {item.brand && <p className="text-[10px] font-medium text-[#C4A46B] uppercase tracking-wide truncate">{item.brand}</p>}
                  {item.collection && <p className="text-[10px] text-[#8A877F] truncate">{item.collection}</p>}
                  {item.design && <p className="text-xs font-medium text-[#2C2C2A] truncate">{item.design}</p>}
                  {item.colour && <p className="text-[10px] text-[#8A877F] truncate">{item.colour}</p>}
                  {item.sku && <p className="text-[10px] text-[#8A877F] truncate font-mono">{item.sku}</p>}
                  <div className="flex items-center justify-between pt-0.5">
                    <p className="text-xs font-semibold text-[#1A1A18]">{formatPrice(item.price_zar)}</p>
                    {item.useable_width_cm && <p className="text-[10px] text-[#8A877F]">{item.useable_width_cm}cm</p>}
                  </div>
                  {item.price_zar != null && isGlobal && (
                    <p className="text-[10px] text-[#8A877F]">Roll (40m): {formatPrice(Math.round(item.price_zar * 0.9 * 40 * 100) / 100)}</p>
                  )}
                  {item.product_id && <div className="pt-1"><StockBadge productId={item.product_id} /></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ItemModal
          priceListId={priceListId}
          item={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
