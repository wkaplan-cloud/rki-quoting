'use client'
import { useEffect, useState } from 'react'
import { PackageOpen, Search, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { addPieceToSlide, type CatalogPiece } from '@/lib/studio/pieces'
import { CATEGORIES } from '@/lib/sourcing-categories'

export const PIECE_DRAG_TYPE = 'application/x-studio-piece'

// Org catalog of Pieces, browsable from inside a board — click or drag a
// piece onto the canvas to place it with its specs already filled in
// (snapshot copy, see addPieceToSlide). Mirrors AssetPanel's interaction
// pattern deliberately, so the two panels feel like the same tool.
export function PiecesPanel() {
  const [pieces, setPieces] = useState<CatalogPiece[] | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('')
  const [placing, setPlacing] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('pieces')
        .select('id, name, description, category, item_specs, dimensions, colour_finish, supplier_id, supplier_name, image_urls')
        .order('name')
      if (!cancelled) setPieces((data ?? []) as CatalogPiece[])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = (pieces ?? []).filter(p => {
    if (category && p.category !== category) return false
    if (query.trim() && !p.name.toLowerCase().includes(query.trim().toLowerCase())) return false
    return true
  })

  async function place(piece: CatalogPiece) {
    setPlacing(piece.id)
    try {
      await addPieceToSlide(piece)
      toast.success(`Added "${piece.name}" to this board`)
    } catch (e) {
      toast.error((e as Error).message || 'Could not place this piece')
    } finally {
      setPlacing(null)
    }
  }

  return (
    <div className="flex-shrink-0 w-[196px] h-full flex flex-col bg-[#F5F2EC] border-l border-[#D8D3C8]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          Pieces · {pieces?.length ?? '…'}
        </span>
      </div>

      <div className="p-2 border-b border-[#D8D3C8] space-y-1.5">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8A877F]" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search catalog…"
            className="w-full pl-6 pr-6 py-1.5 text-[11px] rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              title="Clear"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer"
            >
              <X size={11} />
            </button>
          )}
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full text-[11px] px-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
      </div>

      {pieces === null ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-[#8A877F]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <PackageOpen size={22} className="text-[#D8D3C8] mb-2" />
          <p className="text-[11px] text-[#8A877F] leading-relaxed">
            {pieces.length === 0 ? 'No pieces in your catalog yet' : 'No pieces match'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
          {filtered.map(piece => (
            <PieceThumb key={piece.id} piece={piece} placing={placing === piece.id} onPlace={() => void place(piece)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PieceThumb({ piece, placing, onPlace }: { piece: CatalogPiece; placing: boolean; onPlace: () => void }) {
  const thumb = piece.image_urls[0]
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        draggable={!!thumb}
        title={thumb ? 'Drag onto a slide, or double-click to add' : 'No photo yet'}
        onDragStart={e => {
          if (!thumb) return
          e.dataTransfer.setData(PIECE_DRAG_TYPE, JSON.stringify(piece))
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onDoubleClick={onPlace}
        disabled={placing}
        className="relative aspect-square rounded-md overflow-hidden border border-[#D8D3C8] bg-white cursor-grab active:cursor-grabbing hover:border-[#9A7B4F] transition-colors focus-visible:outline-2 focus-visible:outline-[#9A7B4F] disabled:opacity-50"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" loading="lazy" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <PackageOpen size={16} className="text-[#D8D3C8]" />
          </div>
        )}
        {placing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 size={14} className="animate-spin text-[#8A877F]" />
          </div>
        )}
      </button>
      <span className="text-[10px] text-[#2C2C2A] truncate px-0.5">{piece.name}</span>
    </div>
  )
}
