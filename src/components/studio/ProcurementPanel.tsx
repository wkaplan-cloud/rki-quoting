'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Type, Square, Circle, Minus, MoveUpRight, X, FileText, Send, RefreshCw, ExternalLink } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import type { StudioObject, StudioSpec, StudioSlide } from '@/lib/studio/types'
import { ConvertToQuoteModal } from './ConvertToQuoteModal'
import { SyncQuoteModal } from './SyncQuoteModal'

// Procurement: the board-wide roll-up of every spec'd object across all
// slides, grouped by slide in deck order, and the launchpad for pricing them —
// tick items to send suppliers an RFQ, then create or update the quote.
// Deliberately NOT called Specs: that name belongs to the per-object editor
// (SpecsPanel), which this panel links into. Clicking an entry jumps to its
// slide, selects the object and opens that editor. Toggled from the header —
// same slide-in pattern as the Asset Library.
export function ProcurementPanel() {
  const router = useRouter()
  const slides = useStudioStore(s => s.slides)
  const specs = useStudioStore(s => s.specs)
  const projectId = useStudioStore(s => s.projectId)
  const [converting, setConverting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // Ticked items for "Request quotes" (RFQ) — object ids
  const [checked, setChecked] = useState<Set<string>>(new Set())

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

  const liveIds = groups.flatMap(g => g.entries.map(e => e.obj.id))
  const checkedCount = liveIds.filter(id => checked.has(id)).length

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex-shrink-0 w-[280px] h-full flex flex-col bg-[#F5F2EC] border-l border-[#D8D3C8]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#D8D3C8]">
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest">
          <ShoppingCart size={12} /> Procurement · {total}
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
          <ShoppingCart size={22} className="text-[#D8D3C8] mb-2" />
          <p className="text-[11px] text-[#8A877F] leading-relaxed">
            Nothing to price yet — select an item and choose Specs in its toolbar
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-2">
          <div className="flex items-center justify-between px-3 pb-1">
            <span className="text-[10px] text-[#8A877F]">Tick items to request quotes</span>
            <button
              type="button"
              onClick={() => setChecked(checkedCount === liveIds.length ? new Set() : new Set(liveIds))}
              className="text-[10px] text-[#9A7B4F] hover:underline cursor-pointer"
            >
              {checkedCount === liveIds.length ? 'None' : 'All'}
            </button>
          </div>
          {groups.map(g => (
            <div key={g.slide.id} className="mb-2">
              <div className="px-3 py-1 text-[10px] font-medium text-[#8A877F] uppercase tracking-widest truncate">
                {slideLabel(g.slide, g.index)}
              </div>
              {g.entries.map(({ obj, spec }) => (
                <SpecEntry
                  key={obj.id}
                  slideId={g.slide.id}
                  obj={obj}
                  spec={spec}
                  checked={checked.has(obj.id)}
                  onToggle={() => toggle(obj.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex-shrink-0 p-2 border-t border-[#D8D3C8] space-y-1.5">
          <button
            type="button"
            onClick={() => useStudioStore.getState().openRfq(liveIds.filter(id => checked.has(id)))}
            disabled={checkedCount === 0}
            title="Email suppliers a PDF of the ticked items with their specs"
            className="w-full flex items-center justify-center gap-1.5 h-8 text-xs font-medium bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors cursor-pointer disabled:opacity-40"
          >
            <Send size={13} /> Request quotes{checkedCount > 0 ? ` · ${checkedCount}` : ''}
          </button>
          {projectId ? (
            // Board already converted — update the existing quote (adds new
            // specs, offers to remove ones taken off the board) or jump to it.
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setSyncing(true)}
                title="Add new board items to the linked quote"
                className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-medium bg-[#C4A46B] text-[#1A1A18] rounded-lg hover:bg-[#D4B47B] transition-colors cursor-pointer"
              >
                <RefreshCw size={13} /> Update quote
              </button>
              <button
                type="button"
                onClick={() => router.push(`/projects/${projectId}`)}
                title="Open the linked quote"
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 text-[#8A877F] bg-[#EDE9E1] rounded-lg hover:text-[#2C2C2A] hover:bg-[#E5E0D6] transition-colors cursor-pointer"
              >
                <ExternalLink size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConverting(true)}
              title="Pull all specs into a new quoting project"
              className="w-full flex items-center justify-center gap-1.5 h-8 text-xs font-medium bg-[#C4A46B] text-[#1A1A18] rounded-lg hover:bg-[#D4B47B] transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileText size={13} /> Create quote
            </button>
          )}
        </div>
      )}

      {converting && (
        <ConvertToQuoteModal
          approvedCount={approved}
          draftCount={total - approved}
          onClose={() => setConverting(false)}
        />
      )}

      {syncing && <SyncQuoteModal onClose={() => setSyncing(false)} />}
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
  checked,
  onToggle,
}: {
  slideId: string
  obj: StudioObject
  spec: StudioSpec
  checked: boolean
  onToggle: () => void
}) {
  const approved = spec.status === 'approved'
  const subtitle = spec.supplierName.trim()
  const rfqLine = spec.rfqSentAt
    ? `RFQ sent · ${new Set(spec.rfqSentTo.map(r => r.email)).size || 1} supplier${
        (new Set(spec.rfqSentTo.map(r => r.email)).size || 1) === 1 ? '' : 's'
      } · ${new Date(spec.rfqSentAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
    : null

  function open() {
    const store = useStudioStore.getState()
    store.setCurrentSlide(slideId) // clears selection, so select after
    store.setSelected([obj.id])
    store.openSpecs(obj.id)
  }

  return (
    <div className="flex items-center gap-2 pl-3 pr-1 hover:bg-[#EDE9E1] transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Include ${spec.specName.trim() || 'untitled spec'} in quote request`}
        className="flex-shrink-0 w-3.5 h-3.5 accent-[#9A7B4F] cursor-pointer"
      />
      <button
        type="button"
        onClick={open}
        title="Open spec"
        className="flex-1 min-w-0 flex items-center gap-2.5 py-1.5 pr-2 text-left active:bg-[#E5E0D6] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#9A7B4F]"
      >
        <ObjectThumb obj={obj} />
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] text-[#2C2C2A] truncate">
            {spec.specName.trim() || 'Untitled spec'}
          </span>
          {subtitle && (
            <span className="block text-[10px] text-[#8A877F] truncate">{subtitle}</span>
          )}
          {rfqLine && (
            <span
              className="block text-[9px] text-[#9A7B4F] truncate"
              title={spec.rfqSentTo.map(r => `${r.supplierName || r.email} — ${r.email}`).join('\n')}
            >
              {rfqLine}
            </span>
          )}
        </span>
        <span
          title={approved ? 'Approved' : 'Draft'}
          className="flex-shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: approved ? '#059669' : '#34D399' }}
        />
      </button>
    </div>
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
          crossOrigin="anonymous"
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
    : obj.type === 'cross' ? X
    : Minus
  return (
    <span className="flex-shrink-0 w-9 h-9 rounded-md border border-[#D8D3C8] bg-white flex items-center justify-center text-[#8A877F]">
      <Icon size={14} />
    </span>
  )
}
