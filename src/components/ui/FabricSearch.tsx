'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { ImageOff } from 'lucide-react'

interface FabricResult {
  id: string
  brand: string | null
  collection: string | null
  design: string | null
  colour: string | null
  sku: string | null
  price_zar: number | null
  image_url: string | null
}

interface Props {
  value: string
  onChange: (value: string) => void
  onBlur: (value: string) => void
  onSelect: (fabric: FabricResult) => void
  placeholder?: string
  className?: string
}

function Thumb({ url }: { url: string | null }) {
  const [errored, setErrored] = useState(false)
  if (!url || errored) return (
    <div className="w-8 h-8 rounded bg-[#EDE9E1] flex items-center justify-center flex-shrink-0">
      <ImageOff size={12} className="text-[#C4A46B] opacity-50" />
    </div>
  )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" onError={() => setErrored(true)} />
  )
}

export function FabricSearch({ value, onChange, onBlur, onSelect, placeholder, className }: Props) {
  const [results, setResults] = useState<FabricResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/fabric-search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data ?? [])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(fabric: FabricResult) {
    setOpen(false)
    setResults([])
    onSelect(fabric)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); search(e.target.value) }}
        onBlur={e => onBlur(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      {loading && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 border border-[#9A7B4F] border-t-transparent rounded-full animate-spin" />
      )}
      {open && results.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-[#D8D3C8] rounded-lg shadow-lg w-72 max-h-72 overflow-y-auto">
          {results.map(fabric => (
            <button
              key={fabric.id}
              type="button"
              onMouseDown={() => handleSelect(fabric)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F5F2EC] transition-colors text-left cursor-pointer"
            >
              <Thumb url={fabric.image_url} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#2C2C2A] truncate">{fabric.design || '—'}</p>
                <p className="text-[10px] text-[#8A877F] truncate">
                  {[fabric.collection, fabric.colour].filter(Boolean).join(' · ')}
                </p>
                {fabric.sku && <p className="text-[10px] text-[#8A877F] font-mono truncate">{fabric.sku}</p>}
              </div>
              {fabric.price_zar != null && (
                <span className="text-xs font-semibold text-[#2C2C2A] flex-shrink-0">
                  R {fabric.price_zar.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
