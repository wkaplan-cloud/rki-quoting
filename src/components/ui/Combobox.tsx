'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Option {
  id: string
  label: string
  isPlatform?: boolean
}

interface Props {
  options: Option[]
  value: string        // selected id
  inputValue: string   // displayed text
  onChange: (id: string, label: string) => void
  onCreate?: (label: string) => Promise<{ id: string }>
  placeholder?: string
  label?: string
  className?: string
}

export function Combobox({ options, value, inputValue, onChange, onCreate, placeholder, label, className }: Props) {
  const [query, setQuery] = useState(inputValue)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(inputValue) }, [inputValue])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const calcPos = useCallback(() => {
    if (!inputRef.current) return null
    const rect = inputRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    if (spaceBelow < 220) {
      return { bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width }
    }
    return { top: rect.bottom + 4, left: rect.left, width: rect.width }
  }, [])

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const exactMatch = options.some(o => o.label.toLowerCase() === query.toLowerCase().trim())
  const showCreate = onCreate && query.trim().length > 0 && !exactMatch

  async function handleCreate() {
    if (!onCreate) return
    setCreating(true)
    const { id } = await onCreate(query.trim())
    onChange(id, query.trim())
    setOpen(false)
    setCreating(false)
  }

  function handleSelect(opt: Option) {
    setQuery(opt.label)
    onChange(opt.id, opt.label)
    setOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    onChange('', e.target.value)
    setPos(calcPos())
    setOpen(true)
  }

  function handleClear() {
    setQuery('')
    onChange('', '')
    setOpen(false)
  }

  const dropdown = open && (filtered.length > 0 || showCreate) && pos ? createPortal(
    <div
      style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="bg-white border border-[#D8D3C8] rounded shadow-lg max-h-52 overflow-y-auto"
    >
      {filtered.map(opt => (
        <button
          key={opt.id}
          type="button"
          onMouseDown={() => handleSelect(opt)}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F5F2EC] transition-colors flex items-center justify-between gap-2
            ${opt.id === value ? 'bg-[#F5F2EC] font-medium' : ''}
            ${opt.isPlatform ? 'text-[#9A7B4F]' : 'text-[#2C2C2A]'}`}
        >
          <span>{opt.label}</span>
          {opt.isPlatform && (
            <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#9A7B4F]/10 text-[#9A7B4F]">
              Platform
            </span>
          )}
        </button>
      ))}
      {showCreate && (
        <>
          {filtered.length > 0 && <div className="border-t border-[#EDE9E1]" />}
          <button
            type="button"
            onMouseDown={handleCreate}
            disabled={creating}
            className="w-full text-left px-3 py-2 text-sm text-[#9A7B4F] hover:bg-[#F5F2EC] transition-colors flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span>
            {creating ? 'Creating…' : `Add "${query.trim()}"`}
          </button>
        </>
      )}
    </div>,
    document.body
  ) : null

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {label && (
        <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { setPos(calcPos()); setOpen(true) }}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm text-[#2C2C2A] outline-none focus:border-[#9A7B4F] focus:ring-1 focus:ring-[#9A7B4F] transition-colors placeholder-[#C4BFB5]"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#C4BFB5] hover:text-[#8A877F] transition-colors"
          >
            ×
          </button>
        )}
      </div>
      {dropdown}
    </div>
  )
}
