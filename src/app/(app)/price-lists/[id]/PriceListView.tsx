'use client'
import { useState, useEffect, useRef } from 'react'
import { Search, ImageOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
  const [stock, setStock] = useState<StockInfo | null>(null)

  useEffect(() => {
    fetch(`/api/fabric-stock?productId=${productId}`)
      .then(r => r.json())
      .then(d => { if (d.weeksUntilAvailable !== undefined) setStock(d) })
      .catch(() => {})
  }, [productId])

  if (!stock) return null

  const transitDays = stock.transitDate
    ? Math.ceil((new Date(stock.transitDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
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
          {stock.transitQty!.toLocaleString()}m — in transit (~{Math.ceil((new Date(stock.transitDate!).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))}w)
        </span>
      )}
      {!showLocal && !showTransit && stock.maxLeadTimeDate && (
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
          ~{Math.max(1, Math.ceil((new Date(stock.maxLeadTimeDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))}w lead time
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

export function PriceListView({ priceListId }: { priceListId: string }) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<PriceListItem[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = search.trim()

    if (q.length < 2) {
      setItems([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const words = q.split(/\s+/).filter(Boolean)
      let query = supabase
        .from('price_list_items')
        .select('*')
        .eq('price_list_id', priceListId)
      for (const word of words) {
        query = query.or(`design.ilike.%${word}%,colour.ilike.%${word}%,collection.ilike.%${word}%,sku.ilike.%${word}%,brand.ilike.%${word}%`)
      }
      const { data } = await query.order('brand').order('collection').order('design').limit(60)
      setItems(data ?? [])
      setLoading(false)
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, priceListId, supabase])

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
        <span className="text-xs text-[#8A877F] ml-auto">Local fabrics only — imported fabrics and wallpaper are not listed</span>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-8">
        {search.trim().length < 2 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search size={28} className="text-[#C4A46B] opacity-40 mb-3" />
            <p className="text-sm font-medium text-[#2C2C2A]">Search to find fabrics</p>
            <p className="text-xs text-[#8A877F] mt-1">Type a design name, colour, brand or SKU</p>
            <p className="text-xs text-[#8A877F] mt-3 max-w-xs">Local fabrics only — imported fabrics and wallpaper are not listed</p>
          </div>
        ) : items.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-sm text-[#8A877F]">No fabrics found for &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {items.map(item => (
              <div key={item.id} className="bg-white border border-[#D8D3C8] rounded-lg overflow-hidden hover:border-[#C4A46B] transition-colors">
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
                  {item.price_zar != null && (
                    <p className="text-[10px] text-[#8A877F]">Roll (40m): {formatPrice(Math.round(item.price_zar * 0.9 * 40 * 100) / 100)}</p>
                  )}
                  {item.product_id && <div className="pt-1"><StockBadge productId={item.product_id} /></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
