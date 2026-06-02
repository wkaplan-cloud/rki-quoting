'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const links = [
  { href: '/blog',            label: 'Blog'            },
  { href: '/pricing',         label: 'Pricing'         },
  { href: '/faq',             label: 'FAQ'             },
  { href: '/trades',          label: 'For Trades'      },
  { href: '/supplier-portal', label: 'Supplier Portal' },
  { href: '/login',           label: 'Log in'          },
]

export function NavMobile() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-[#D8D3C8] text-[#2C2C2A] hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {open && (
        <div className="sm:hidden fixed inset-x-0 top-[80px] z-40 bg-[#F5F2EC]/97 backdrop-blur-sm border-b border-[#D8D3C8] shadow-lg">
          <nav className="flex flex-col px-6 py-4 gap-1">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-[#2C2C2A] hover:text-[#9A7B4F] border-b border-[#EDE9E1] last:border-0 transition-colors"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-3 flex items-center justify-center px-4 py-3 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
            >
              Start for free
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
