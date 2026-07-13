'use client'
import { Images } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { addAssetToSlide } from '@/lib/studio/images'
import type { StudioAsset } from '@/lib/studio/types'

export const ASSET_DRAG_TYPE = 'application/x-studio-asset'

// Project asset library: every image imported into this board, newest first.
// Drag a thumbnail onto the canvas (or double-click) to reuse it on the
// current slide — no re-upload, duplicates are already collapsed by hash.
export function AssetPanel() {
  const assets = useStudioStore(s => s.assets)

  return (
    <div className="flex-shrink-0 w-[196px] h-full flex flex-col bg-[#F5F2EC] border-l border-[#D8D3C8]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          Assets · {assets.length}
        </span>
      </div>

      {assets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <Images size={22} className="text-[#D8D3C8] mb-2" />
          <p className="text-[11px] text-[#8A877F] leading-relaxed">
            Images you import appear here — drag them back onto any slide
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
          {assets.map(asset => (
            <AssetThumb key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  )
}

function AssetThumb({ asset }: { asset: StudioAsset }) {
  return (
    <button
      type="button"
      draggable
      title="Drag onto a slide, or double-click to add"
      onDragStart={e => {
        e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(asset))
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onDoubleClick={() => addAssetToSlide(asset)}
      className="relative aspect-square rounded-md overflow-hidden border border-[#D8D3C8] bg-white cursor-grab active:cursor-grabbing hover:border-[#9A7B4F] transition-colors focus-visible:outline-2 focus-visible:outline-[#9A7B4F]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt=""
        loading="lazy"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
    </button>
  )
}
