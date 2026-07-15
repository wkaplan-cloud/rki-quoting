'use client'
import { useState } from 'react'
import { X, Printer } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { PAGE_W, PAGE_H } from '@/lib/studio/constants'
import { thumbCache } from './SlidePanel'

// Slide picker shown before printing — every slide is ticked by default
// (the common case is "print the whole board"), with the option to narrow
// it down. Confirming hands the selected slide IDs, in board order, up to
// EditorShell, which runs them through the same ExportRunner pipeline the
// Export PDF button uses, just opened for printing instead of downloaded.
export function PrintSlidesModal({
  onCancel,
  onPrint,
}: {
  onCancel: () => void
  onPrint: (slideIds: string[], printWindow: Window | null) => void
}) {
  const slides = useStudioStore(s => s.slides)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(slides.map(s => s.id)))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = selected.size === slides.length
  const thumbW = 56
  const thumbH = (thumbW * PAGE_H) / PAGE_W

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-[#F5F2EC] border border-[#D8D3C8] shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D8D3C8] flex-shrink-0">
          <span className="text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">Print slides</span>
          <button
            type="button"
            onClick={onCancel}
            title="Close"
            className="w-6 h-6 flex items-center justify-center rounded-md text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex items-center justify-between px-4 pt-3 flex-shrink-0">
          <span className="text-[11px] text-[#8A877F]">
            {selected.size} of {slides.length} selected
          </span>
          <button
            type="button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(slides.map(s => s.id)))}
            className="text-[11px] text-[#9A7B4F] hover:underline cursor-pointer"
          >
            {allSelected ? 'Select none' : 'Select all'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {slides.map((slide, i) => {
            const cached = thumbCache.get(slide)
            const checked = selected.has(slide.id)
            return (
              <label
                key={slide.id}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#EDE9E1] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(slide.id)}
                  className="w-3.5 h-3.5 accent-[#9A7B4F] cursor-pointer flex-shrink-0"
                />
                <div
                  style={{ width: thumbW, height: thumbH }}
                  className="flex-shrink-0 rounded border border-[#D8D3C8] bg-white overflow-hidden"
                >
                  {cached && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cached.url} alt="" width={thumbW} height={thumbH} draggable={false} />
                  )}
                </div>
                <span className="text-[12px] text-[#2C2C2A]">Slide {i + 1}</span>
              </label>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#D8D3C8] flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3 text-xs text-[#8A877F] hover:text-[#2C2C2A] hover:bg-[#EDE9E1] rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              // Open the tab synchronously, right inside the click handler —
              // this is the one moment the browser trusts as "a real user
              // action" and won't block. Everything after this (rendering
              // slides, assembling the PDF) is async and takes seconds; a
              // window.open() fired after all that would get silently
              // blocked as an unsolicited popup. We navigate this same
              // already-open tab to the finished PDF once it's ready.
              const win = window.open('', '_blank')
              if (win) {
                win.document.title = 'Preparing print…'
                win.document.body.style.cssText =
                  'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font:14px system-ui;color:#8A877F;background:#F5F2EC'
                win.document.body.textContent = 'Preparing your PDF for printing…'
              }
              onPrint(slides.filter(s => selected.has(s.id)).map(s => s.id), win)
            }}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-50"
          >
            <Printer size={13} /> Print{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
