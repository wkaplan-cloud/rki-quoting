'use client'
import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SWATCHES } from '@/lib/studio/constants'

export function TBtn({
  icon: Icon,
  label,
  onClick,
  active = false,
  spin = false,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  active?: boolean
  spin?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer
        ${active ? 'bg-[#9A7B4F]/15 text-[#9A7B4F]' : 'text-[#2C2C2A] hover:bg-[#EDE9E1]'}
        focus-visible:outline-2 focus-visible:outline-[#9A7B4F] active:scale-95`}
    >
      <Icon size={15} className={spin ? 'animate-spin' : undefined} />
    </button>
  )
}

export function TDivider() {
  return <div className="w-px h-5 bg-[#D8D3C8] mx-0.5" />
}

// Small colour popover: preset swatches + a native picker for anything else
export function ColorControl({
  value,
  onChange,
  label,
  allowNone = false,
}: {
  value: string
  onChange: (color: string) => void
  label: string
  allowNone?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#EDE9E1] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#9A7B4F] active:scale-95"
      >
        <span
          className="w-4 h-4 rounded-full border border-[#D8D3C8]"
          style={
            value === 'transparent'
              ? { background: 'repeating-conic-gradient(#D8D3C8 0% 25%, #fff 0% 50%) 0 0 / 8px 8px' }
              : { backgroundColor: value }
          }
        />
      </button>
      {open && (
        <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg border border-[#D8D3C8] p-2 z-50 w-[152px]">
          <div className="grid grid-cols-6 gap-1 mb-2">
            {SWATCHES.map(c => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
                className={`w-5 h-5 rounded-full border cursor-pointer transition-transform hover:scale-110 ${value === c ? 'border-[#9A7B4F] ring-1 ring-[#9A7B4F]' : 'border-[#D8D3C8]'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={value.startsWith('#') ? value : '#2C2C2A'}
              onChange={e => onChange(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border border-[#D8D3C8] p-0"
              aria-label="Custom colour"
            />
            <span className="text-[10px] text-[#8A877F]">Custom</span>
            {allowNone && (
              <button
                type="button"
                onClick={() => {
                  onChange('transparent')
                  setOpen(false)
                }}
                className="ml-auto text-[10px] text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer"
              >
                None
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
