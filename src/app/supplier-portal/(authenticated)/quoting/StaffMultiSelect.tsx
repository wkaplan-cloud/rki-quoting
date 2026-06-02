'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

const S = {
  card: '#FFFFFF', bg: '#F0F2F5', accent: '#3A7CA5',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
}

interface StaffOption {
  id: string
  name: string
  color: string | null
}

interface Props {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  staff: StaffOption[]
  disabled?: boolean
  placeholder?: string
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function staffColor(color: string | null) {
  return color ?? '#3A7CA5'
}

export function StaffMultiSelect({ selectedIds, onChange, staff, disabled, placeholder = 'Assign technicians…' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const selected = staff.filter(s => selectedIds.includes(s.id))
  const available = staff.filter(s => !selectedIds.includes(s.id))

  function add(id: string) {
    onChange([...selectedIds, id])
  }

  function remove(id: string) {
    onChange(selectedIds.filter(x => x !== id))
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="min-h-[38px] flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-xl cursor-pointer"
        style={{ border: `1px solid ${S.border}`, background: disabled ? S.bg : S.card }}
        onClick={() => { if (!disabled && available.length > 0) setOpen(o => !o) }}>

        {selected.map(s => (
          <span key={s.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: `${staffColor(s.color)}18`, color: staffColor(s.color), border: `1px solid ${staffColor(s.color)}30` }}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{ background: staffColor(s.color), color: '#fff' }}>
              {initials(s.name)}
            </span>
            {s.name}
            {!disabled && (
              <button
                onMouseDown={e => { e.stopPropagation(); e.preventDefault(); remove(s.id) }}
                style={{ color: staffColor(s.color) }}>
                <X size={10} />
              </button>
            )}
          </span>
        ))}

        {selected.length === 0 && (
          <span className="text-sm" style={{ color: S.muted }}>{placeholder}</span>
        )}

        {!disabled && available.length > 0 && (
          <ChevronDown size={13} className="ml-auto flex-shrink-0" style={{ color: S.muted }} />
        )}
      </div>

      {open && !disabled && available.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl overflow-hidden"
          style={{ background: S.card, border: `1px solid ${S.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          {available.map(s => (
            <button key={s.id}
              onMouseDown={e => { e.preventDefault(); add(s.id); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors"
              onMouseEnter={e => e.currentTarget.style.background = S.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: staffColor(s.color), color: '#fff' }}>
                {initials(s.name)}
              </span>
              <span className="text-sm" style={{ color: S.text }}>{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
