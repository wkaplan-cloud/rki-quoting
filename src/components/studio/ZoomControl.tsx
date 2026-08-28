'use client'
import { useEffect, useRef, useState } from 'react'
import { Hand, MousePointer2, Minus, Plus, Maximize2 } from 'lucide-react'
import { useStudioStore } from '@/lib/studio/store'
import { MIN_ZOOM, MAX_ZOOM } from '@/lib/studio/constants'
import {
  fitViewport,
  centreViewport,
  zoomAtCentre,
  nextZoomUp,
  nextZoomDown,
  type ViewSize,
} from '@/lib/studio/viewport'

const PRESET_MENU: { label: string; zoom: number | 'fit'; hint?: string }[] = [
  { label: 'Fit to page', zoom: 'fit', hint: '⌘0' },
  { label: '50%', zoom: 0.5 },
  { label: '100%', zoom: 1, hint: '⌘1' },
  { label: '200%', zoom: 2 },
  { label: '400%', zoom: 4 },
]

// Bottom-right viewport control: select/hand tool, zoom out, current zoom
// (with a preset menu), zoom in. Sits inside CanvasArea so it tracks the
// canvas as the side panels open and close.
export function ZoomControl({
  size,
  handTool,
  onHandToolChange,
}: {
  size: ViewSize
  handTool: boolean
  onHandToolChange: (on: boolean) => void
}) {
  const viewport = useStudioStore(s => s.viewport)
  const setViewport = useStudioStore(s => s.setViewport)
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  if (!size.w || !size.h) return null

  const percent = Math.round(viewport.zoom * 100)

  function apply(zoom: number | 'fit') {
    setViewport(zoom === 'fit' ? fitViewport(size) : centreViewport(zoom, size))
  }

  return (
    <div
      ref={ref}
      className="absolute bottom-3 right-3 z-40 flex items-center gap-0.5 bg-white rounded-xl border border-[#D8D3C8] px-1.5 py-1"
      style={{ boxShadow: '0 2px 8px rgba(26,26,24,0.08), 0 8px 24px rgba(26,26,24,0.1)' }}
    >
      <ZBtn
        icon={MousePointer2}
        label="Select tool (V)"
        toggle
        active={!handTool}
        onClick={() => onHandToolChange(false)}
      />
      <ZBtn
        icon={Hand}
        label="Hand tool — drag to move around (H, or hold Space)"
        toggle
        active={handTool}
        onClick={() => onHandToolChange(true)}
      />
      <div className="w-px h-5 bg-[#D8D3C8] mx-0.5" />
      <ZBtn
        icon={Minus}
        label="Zoom out (⌘−)"
        disabled={viewport.zoom <= MIN_ZOOM + 0.001}
        onClick={() => setViewport(zoomAtCentre(viewport, nextZoomDown(viewport.zoom), size))}
      />
      <button
        type="button"
        title="Zoom presets"
        aria-label={`Zoom ${percent} percent — change`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onMouseDown={e => e.preventDefault()}
        onClick={() => setMenuOpen(o => !o)}
        className="h-8 min-w-[54px] px-1.5 flex items-center justify-center rounded-md text-xs tabular-nums text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#9A7B4F] active:scale-95"
      >
        {percent}%
      </button>
      <ZBtn
        icon={Plus}
        label="Zoom in (⌘+)"
        disabled={viewport.zoom >= MAX_ZOOM - 0.001}
        onClick={() => setViewport(zoomAtCentre(viewport, nextZoomUp(viewport.zoom), size))}
      />
      <div className="w-px h-5 bg-[#D8D3C8] mx-0.5" />
      <ZBtn icon={Maximize2} label="Fit to page (⌘0)" onClick={() => apply('fit')} />

      {menuOpen && (
        <div
          role="menu"
          className="absolute bottom-11 right-0 w-[168px] bg-white rounded-lg border border-[#D8D3C8] p-1 z-50"
          style={{ boxShadow: '0 2px 8px rgba(26,26,24,0.08), 0 8px 24px rgba(26,26,24,0.1)' }}
        >
          {PRESET_MENU.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                apply(item.zoom)
                setMenuOpen(false)
              }}
              className="w-full flex items-center justify-between gap-2 px-2 h-8 rounded-md text-xs text-[#2C2C2A] hover:bg-[#EDE9E1] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#9A7B4F]"
            >
              <span>{item.label}</span>
              {item.hint && <span className="text-[10px] text-[#8A877F]">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ZBtn({
  icon: Icon,
  label,
  onClick,
  active = false,
  toggle = false,
  disabled = false,
}: {
  icon: typeof Hand
  label: string
  onClick: () => void
  active?: boolean
  toggle?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={toggle ? active : undefined}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer
        ${active ? 'bg-[#9A7B4F]/15 text-[#9A7B4F]' : 'text-[#2C2C2A] hover:bg-[#EDE9E1]'}
        focus-visible:outline-2 focus-visible:outline-[#9A7B4F] active:scale-95
        disabled:opacity-35 disabled:cursor-default disabled:hover:bg-transparent disabled:active:scale-100`}
    >
      <Icon size={15} />
    </button>
  )
}
