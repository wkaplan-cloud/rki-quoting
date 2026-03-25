'use client'
import { useState, useMemo, useEffect } from 'react'
import { Search, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react'

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
}

const PAGE_SIZE = 120

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
    <img
      src={url}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setErrored(true)}
    />
  )
}

export function PriceListView({ items }: { items: PriceListItem[] }) {
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [collectionFilter, setCollectionFilter] = useState('')
  const [page, setPage] = useState(1)

  const brands = useMemo(() => {
    const s = new Set(items.map(i => i.brand).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [items])

  const collections = useMemo(() => {
    const source = brandFilter ? items.filter(i => i.brand === brandFilter) : items
    const s = new Set(source.map(i => i.collection).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [items, brandFilter])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter(item => {
      if (brandFilter && item.brand !== brandFilter) return false
      if (collectionFilter && item.collection !== collectionFilter) return false
      if (!q) return true
      return (
        item.brand?.toLowerCase().includes(q) ||
        item.collection?.toLowerCase().includes(q) ||
        item.design?.toLowerCase().includes(q) ||
        item.colour?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.product_id?.toLowerCase().includes(q)
      )
    })
  }, [items, search, brandFilter, collectionFilter])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [search, brandFilter, collectionFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleBrandChange(brand: string) {
    setBrandFilter(brand)
    setCollectionFilter('')
  }

  const from = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, filtered.length)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Filter bar */}
      <div className="px-8 py-4 border-b border-[#D8D3C8] bg-[#F5F2EC] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A877F]" />
          <input
            type="text"
            placeholder="Search design, colour, SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] placeholder-[#8A877F] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors"
          />
        </div>

        <select
          value={brandFilter}
          onChange={e => handleBrandChange(e.target.value)}
          className="px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors cursor-pointer"
        >
          <option value="">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select
          value={collectionFilter}
          onChange={e => setCollectionFilter(e.target.value)}
          className="px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] outline-none transition-colors cursor-pointer"
          disabled={collections.length === 0}
        >
          <option value="">All Collections</option>
          {collections.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <span className="text-xs text-[#8A877F] ml-auto">
          {filtered.length.toLocaleString()} {filtered.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-[#8A877F]">No items match your search</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {paginated.map(item => (
                <div key={item.id} className="bg-white border border-[#D8D3C8] rounded-lg overflow-hidden group hover:border-[#C4A46B] transition-colors">
                  <div className="aspect-square overflow-hidden bg-[#EDE9E1]">
                    <ItemImage url={item.image_url} alt={[item.design, item.colour].filter(Boolean).join(' ')} />
                  </div>
                  <div className="p-2.5 space-y-1">
                    {item.brand && (
                      <p className="text-[10px] font-medium text-[#C4A46B] uppercase tracking-wide truncate">{item.brand}</p>
                    )}
                    {item.collection && (
                      <p className="text-[10px] text-[#8A877F] truncate">{item.collection}</p>
                    )}
                    {item.design && (
                      <p className="text-xs font-medium text-[#2C2C2A] truncate">{item.design}</p>
                    )}
                    {item.colour && (
                      <p className="text-[10px] text-[#8A877F] truncate">{item.colour}</p>
                    )}
                    {item.sku && (
                      <p className="text-[10px] text-[#8A877F] truncate font-mono">{item.sku}</p>
                    )}
                    <p className="text-xs font-semibold text-[#1A1A18] pt-0.5">{formatPrice(item.price_zar)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded border border-[#D8D3C8] text-[#8A877F] hover:text-[#2C2C2A] hover:border-[#9A7B4F] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-[#8A877F]">
                  {from.toLocaleString()}–{to.toLocaleString()} of {filtered.length.toLocaleString()}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded border border-[#D8D3C8] text-[#8A877F] hover:text-[#2C2C2A] hover:border-[#9A7B4F] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
