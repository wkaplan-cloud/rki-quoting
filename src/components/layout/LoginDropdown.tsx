'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, Paintbrush, Package, Zap } from 'lucide-react'

const portals = [
  {
    href: '/login',
    icon: Paintbrush,
    label: 'Designer / Studio',
    desc: 'Interior designers & decorators',
  },
  {
    href: '/supplier-portal',
    icon: Package,
    label: 'Supplier Portal',
    desc: 'Manage pricing requests & catalogue',
  },
  {
    href: '/trades',
    icon: Zap,
    label: 'Electrician / Trades',
    desc: 'Field staff & contractor portal',
  },
]

export function LoginDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium"
        aria-haspopup="true"
        aria-expanded={open}
      >
        Log in
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-[#D8D3C8] rounded-xl shadow-[0_8px_32px_rgba(26,26,24,0.12)] overflow-hidden z-50">
          <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold text-[#C4BFB5] uppercase tracking-widest">
            Log in as
          </p>
          {portals.map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#F5F2EC] transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#9A7B4F]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#9A7B4F]/20 transition-colors">
                <Icon size={15} className="text-[#9A7B4F]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">{label}</p>
                <p className="text-xs text-[#8A877F]">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
