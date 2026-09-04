'use client'
import { useEffect, useMemo, useState } from 'react'
import { X, Images, Search, Check } from 'lucide-react'
import type { StudioAsset } from '@/lib/studio/types'

// Picker window for the Specs panel's Images section. The panel itself is only
// 280px wide, so choosing from the board's library inline meant squinting at
// three tiny unlabelled thumbnails; this opens over the canvas instead, big
// enough to read the names and tick off several images in one go.
export function SpecAssetPickerModal({
  assets,
  usedUrls,
  onAdd,
  onClose,
}: {
  assets: StudioAsset[]
  usedUrls: Set<string>
  onAdd: (chosen: StudioAsset[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  // Captured so the canvas's global shortcuts don't also see the key — Escape
  // there clears the selection, Backspace deletes the selected object.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (!typing) onClose()
      } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets
    return assets.filter(a => (a.label ?? '').toLowerCase().includes(q))
  }, [assets, query])

  function toggle(asset: StudioAsset) {
    if (usedUrls.has(asset.url)) return
    setSelected(prev =>
      prev.includes(asset.id) ? prev.filter(id => id !== asset.id) : [...prev, asset.id]
    )
  }

  function add() {
    const chosen = assets.filter(a => selected.includes(a.id))
    if (!chosen.length) return
    onAdd(chosen)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8]">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
            <Images size={12} /> Add images from library
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#9A7B4F]"
          >
            <X size={13} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A877F] pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search this board's images by name"
              className="w-full text-[11px] pl-7 pr-2 py-1.5 rounded-md border border-[#D8D3C8] bg-white outline-none focus:border-[#9A7B4F] transition-colors text-[#2C2C2A]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {assets.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-[#8A877F]">
              No images in this board&rsquo;s library yet.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-[11px] text-[#8A877F]">
              No images named &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {filtered.map(asset => {
                const already = usedUrls.has(asset.url)
                const isSelected = selected.includes(asset.id)
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => toggle(asset)}
                    disabled={already}
                    aria-pressed={isSelected}
                    title={asset.label ?? 'Unnamed'}
                    className={`group relative flex flex-col gap-1 text-left rounded-lg border p-1 transition-colors cursor-pointer disabled:cursor-default focus-visible:outline-2 focus-visible:outline-[#9A7B4F] ${
                      isSelected
                        ? 'border-[#9A7B4F] bg-white'
                        : already
                          ? 'border-[#D8D3C8] bg-white/50'
                          : 'border-[#D8D3C8] bg-white hover:border-[#9A7B4F]'
                    }`}
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-md bg-[#EDE9E1]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.url}
                        alt={asset.label ?? ''}
                        loading="lazy"
                        crossOrigin="anonymous"
                        className={`w-full h-full object-cover transition-opacity ${
                          already ? 'opacity-30' : ''
                        }`}
                      />
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-[#9A7B4F] text-white">
                          <Check size={12} />
                        </span>
                      )}
                      {already && (
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-white/90 text-[9px] text-[#8A877F]">
                          Added
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#2C2C2A] leading-tight truncate">
                      {asset.label || 'Unnamed'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#D8D3C8]">
          <span className="text-[10px] text-[#8A877F]">
            {selected.length ? `${selected.length} selected` : 'Pick one or more images'}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-[#D8D3C8] bg-white text-[#8A877F] hover:text-[#2C2C2A] hover:border-[#9A7B4F] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={add}
              disabled={selected.length === 0}
              className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-[#2C2C2A] text-white hover:bg-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default disabled:hover:bg-[#2C2C2A]"
            >
              {selected.length > 1 ? `Add ${selected.length} images` : 'Add image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
