'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Tag, LogOut, ChevronRight } from 'lucide-react'

interface Props {
  companyName: string
}

const NAV_ITEMS = [
  { href: '/supplier-portal/dashboard', label: 'Price Requests', icon: LayoutDashboard },
  { href: '/supplier-portal/price-list', label: 'My Price List', icon: Tag },
]

export function SupplierPortalNav({ companyName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/supplier-portal/login')
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 flex flex-col z-30" style={{ background: '#1C2B3A' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: '#2D3F52' }}>
        <Link href="/supplier-portal/dashboard" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="w-24 h-auto object-contain" style={{ filter: 'invert(1) brightness(0.75)' }} />
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-widest mt-2" style={{ color: '#4A7FA5' }}>
          Supplier Portal
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group"
              style={{
                background: active ? '#2D4159' : 'transparent',
                color: active ? '#E8F0F8' : '#7A9AB8',
              }}
            >
              <Icon size={15} style={{ color: active ? '#5BA3DC' : '#4A7FA5' }} />
              <span>{label}</span>
              {active && <ChevronRight size={12} className="ml-auto" style={{ color: '#5BA3DC' }} />}
            </Link>
          )
        })}
      </nav>

      {/* Footer: company + sign out */}
      <div className="px-4 py-4 border-t" style={{ borderColor: '#2D3F52' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#2D4159', color: '#5BA3DC' }}>
            {companyName.charAt(0).toUpperCase()}
          </div>
          <p className="text-xs font-medium truncate" style={{ color: '#A8C4DC' }}>{companyName}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs w-full px-2 py-1.5 rounded-lg transition-colors"
          style={{ color: '#4A7FA5' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#7A9AB8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#4A7FA5')}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
