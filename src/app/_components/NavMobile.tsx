'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Package, Zap } from 'lucide-react'

const mainLinks = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq',     label: 'FAQ'     },
  { href: '/blog',    label: 'Blog'    },
]

const partnerLinks = [
  { href: '/supplier-portal/login', icon: Package, label: 'Supplier Portal',   desc: 'Manage pricing requests & catalogue' },
  { href: '/trades',                icon: Zap,     label: 'For Trades',         desc: 'Electricians, plumbers & contractors' },
]

export function NavMobile({ trades }: { trades?: boolean } = {}) {
  const [open, setOpen] = useState(false)

  const loginHref  = trades ? '/supplier-portal/login'               : '/login'
  const signupHref = trades ? '/supplier-portal/register?type=trades' : '/signup'

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
          <nav className="flex flex-col px-6 py-4">

            {/* Main links */}
            {mainLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-[#2C2C2A] hover:text-[#9A7B4F] border-b border-[#EDE9E1] transition-colors"
              >
                {label}
              </Link>
            ))}

            {/* CTA buttons */}
            <div className="flex gap-2 mt-4">
              <Link
                href={loginHref}
                onClick={() => setOpen(false)}
                className="flex-1 flex items-center justify-center px-4 py-3 border border-[#D8D3C8] text-[#2C2C2A] text-sm font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors"
              >
                Log in
              </Link>
              <Link
                href={signupHref}
                onClick={() => setOpen(false)}
                className="flex-1 flex items-center justify-center px-4 py-3 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
              >
                Get started free
              </Link>
            </div>

            {/* Partner portals */}
            <p className="pt-5 pb-2 text-[10px] font-semibold text-[#C4BFB5] uppercase tracking-widest">
              Partner portals
            </p>
            {partnerLinks.map(({ href, icon: Icon, label, desc }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 py-3 border-b border-[#EDE9E1] last:border-0 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#9A7B4F]/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-[#9A7B4F]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A1A18]">{label}</p>
                  <p className="text-xs text-[#8A877F]">{desc}</p>
                </div>
              </Link>
            ))}

          </nav>
        </div>
      )}
    </>
  )
}
