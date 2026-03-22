'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface Option {
  id: string
  label: string
}

interface Props {
  options: Option[]
  value: string        // selected id
  inputValue: string   // displayed text
  onChange: (id: string, label: string) => void
  onCreate: (label: string) => Promise<{ id: string }>
  placeholder?: string
  label?: string
  className?: string
}

export function Combobox({ options, value, inputValue, onChange, onCreate, placeholder, label, className }: Props) {
  const [query, setQuery] = useState(inputValue)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync external inputValue changes (e.g. form reset)
  useEffect(() => { setQuery(inputValue) }, [inputValue])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Decide whether to open up or down based on available space
  function checkFlip() {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setDropUp(spaceBelow < 220)
  }

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const exactMatch = options.some(o => o.label.toLowerCase() === query.toLowerCase().trim())
  const showCreate = query.trim().length > 0 && !exactMatch

  async function handleCreate() {
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
    onChange('', e.target.value) // clear id while typing
    checkFlip()
    setOpen(true)
  }

  function handleClear() {
    setQuery('')
    onChange('', '')
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      {label && (
        <label className="block text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => { checkFlip(); setOpen(true) }}
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

      {open && (filtered.length > 0 || showCreate) && (
        <div className={`absolute z-50 w-full bg-white border border-[#D8D3C8] rounded shadow-lg max-h-52 overflow-y-auto
          ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {filtered.map(opt => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={() => handleSelect(opt)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#F5F2EC] transition-colors
                ${opt.id === value ? 'bg-[#F5F2EC] text-[#9A7B4F] font-medium' : 'text-[#2C2C2A]'}`}
            >
              {opt.label}
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
        </div>
      )}
    </div>
  )
}
