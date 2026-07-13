'use client'
import { useState } from 'react'
import { ClipboardList, Type, Square, Circle, Minus, MoveUpRight, FileText } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import type { StudioObject, StudioSpec, StudioSlide } from '@/lib/studio/types'
import { ConvertToQuoteModal } from './ConvertToQuoteModal'

// Board-wide specs overview: every spec'd object across all slides, grouped
// by slide in deck order. Clicking an entry jumps to its slide, selects the
// object and opens the per-object spec editor. Toggled from the header —
// same slide-in pattern as the Asset Library.
export function SpecsListPanel() {
  const slides = useStudioStore(s => s.slides)
  const specs = useStudioStore(s => s.specs)
  const [converting, setConverting] = useState(false)

  // Only specs whose object is still live on a slide — deleted objects keep
  // their spec in memory for undo, but shouldn't appear in the overview
  const groups = slides
    .map((slide, i) => ({
      slide,
      index: i,
      entries: slide.objects
        .filter(o => specs[o.id])
        .map(o => ({ obj: o, spec: specs[o.id] })),
    }))
    .filter(g => g.entries.length > 0)

  const total = groups.reduce((n, g) => n + g.entries.length, 0)
  const approved = groups.reduce(
    (n, g) => n + g.entries.filter(e => e.spec.status === 'approved').length,
    0
  )

  return (
    <div className="flex-shrink-0 w-[280px] h-full flex flex-col bg-[#F5F2EC] border-l border-[#D8D3C8]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          <ClipboardList size={12} /> Specs · {total}
        </span>
        {total > 0 && (
          <span
            className={`text-[10px] font-medium ${
              approved === total ? 'text-[#059669]' : 'text-[#8A877F]'
            }`}
          >
            {approved}/{total} approved
          </span>
        )}
      </div>

      {total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
          <ClipboardList size={22} className="text-[#D8D3C8] mb-2" />
          <p className="text-[11px] text-[#8A877F] leading-relaxed">
            No specs yet — select an object and choose Specs in its toolbar
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-2">
          {groups.map(g => (
            <div key={g.slide.id} className="mb-2">
              <div className="px-3 py-1 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest truncate">
                {slideLabel(g.slide, g.index)}
              </div>
              {g.entries.map(({ obj, spec }) => (
                <SpecEntry key={obj.id} slideId={g.slide.id} obj={obj} spec={spec} />
              ))}
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex-shrink-0 p-2 border-t border-[#D8D3C8]">
          <button
            type="button"
            onClick={() => setConverting(true)}
            disabled={approved === 0}
            title="Pull approved specs into a new quoting project"
            className="w-full flex items-center justify-center gap-1.5 h-8 text-xs font-medium bg-[#C4A46B] text-[#1A1A18] rounded-lg hover:bg-[#D4B47B] transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileText size={13} /> Create quote
          </button>
        </div>
      )}

      {converting && (
        <ConvertToQuoteModal
          approvedCount={approved}
          draftCount={total - approved}
          onClose={() => setConverting(false)}
        />
      )}
    </div>
  )
}

function slideLabel(slide: StudioSlide, index: number) {
  return slide.heading.trim() || slide.name.trim() || `Slide ${index + 1}`
}

function SpecEntry({
  slideId,
  obj,
  spec,
}: {
  slideId: string
  obj: StudioObject
  spec: StudioSpec
}) {
  const approved = spec.status === 'approved'
  const subtitle = [spec.supplierName.trim(), spec.category.trim()].filter(Boolean).join(' · ')

  function open() {
    const store = useStudioStore.getState()
    store.setCurrentSlide(slideId) // clears selection, so select after
    store.setSelected([obj.id])
    store.openSpecs(obj.id)
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Open spec"
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[#EDE9E1] active:bg-[#E5E0D6] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#9A7B4F]"
    >
      <ObjectThumb obj={obj} />
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] text-[#2C2C2A] truncate">
          {spec.specName.trim() || 'Untitled spec'}
        </span>
        {subtitle && (
          <span className="block text-[10px] text-[#8A877F] truncate">{subtitle}</span>
        )}
      </span>
      <span
        title={approved ? 'Approved' : 'Draft'}
        className="flex-shrink-0 w-2 h-2 rounded-full"
        style={{ backgroundColor: approved ? '#059669' : '#34D399' }}
      />
    </button>
  )
}

// Small preview: images show the picture itself, other object types an icon
function ObjectThumb({ obj }: { obj: StudioObject }) {
  if (obj.type === 'image') {
    return (
      <span className="flex-shrink-0 w-9 h-9 rounded-md overflow-hidden border border-[#D8D3C8] bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={obj.url}
          alt=""
          loading="lazy"
          draggable={false}
          className="w-full h-full object-cover pointer-events-none"
        />
      </span>
    )
  }
  const Icon =
    obj.type === 'text' ? Type
    : obj.type === 'rect' ? Square
    : obj.type === 'ellipse' ? Circle
    : obj.type === 'arrow' ? MoveUpRight
    : Minus
  return (
    <span className="flex-shrink-0 w-9 h-9 rounded-md border border-[#D8D3C8] bg-white flex items-center justify-center text-[#8A877F]">
      <Icon size={14} />
    </span>
  )
}
