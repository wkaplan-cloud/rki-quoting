'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ChevronDown, FileText, HardHat, Hammer } from 'lucide-react'

const options = [
  {
    href: '/',
    icon: FileText,
    label: 'For Designers',
    desc: 'Interior designers & decorators',
  },
  {
    href: '/trades',
    icon: HardHat,
    label: 'For Trades',
    desc: 'Electricians & contractors',
  },
  {
    href: '/manufacturer',
    icon: Hammer,
    label: 'For Manufacturers',
    desc: 'Furniture makers & workshops',
  },
]

export function NavDropdown() {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  function show() {
    clearTimeout(timer.current)
    setOpen(true)
  }
  function hide() {
    timer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <div className="relative hidden sm:block" onMouseEnter={show} onMouseLeave={hide}>
      <button
        className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        Solutions
        <ChevronDown size={13} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1 z-50">
          <div className="bg-white border border-[#D8D3C8] rounded-xl shadow-[0_8px_30px_rgba(26,26,24,0.10)] p-2 min-w-[230px]">
            {options.map(({ href, icon: Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F5F2EC] transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-[#9A7B4F]/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={13} className="text-[#9A7B4F]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A1A18] leading-none mb-0.5">{label}</p>
                  <p className="text-xs text-[#8A877F]">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
