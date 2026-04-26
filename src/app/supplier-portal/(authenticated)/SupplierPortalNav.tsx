'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LayoutDashboard, Tag, LogOut, User } from 'lucide-react'

interface Props {
  companyName: string
  pendingCount: number
}

const NAV_ITEMS = [
  { href: '/supplier-portal/dashboard', label: 'Price Requests', icon: LayoutDashboard, showBadge: true },
  { href: '/supplier-portal/price-list', label: 'My Price List', icon: Tag, showBadge: false },
]

export function SupplierPortalNav({ companyName, pendingCount }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/supplier-portal/login')
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 flex flex-col z-30" style={{ background: '#1C2B3A' }}>
      {/* Logo — centered */}
      <div className="px-5 py-5 flex flex-col items-center border-b" style={{ borderColor: '#2D3F52' }}>
        <Link href="/supplier-portal/dashboard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="w-24 h-auto object-contain" style={{ filter: 'invert(1) brightness(0.75)' }} />
        </Link>
        <p className="text-[10px] font-semibold uppercase tracking-widest mt-2 text-center" style={{ color: '#4A7FA5' }}>
          Supplier Portal
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, showBadge }) => {
          const active = pathname.startsWith(href)
          const badgeCount = showBadge ? pendingCount : 0
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? '#2D4159' : 'transparent',
                color: active ? '#E8F0F8' : '#7A9AB8',
              }}
            >
              <Icon size={15} style={{ color: active ? '#5BA3DC' : '#4A7FA5' }} />
              <span className="flex-1">{label}</span>
              {badgeCount > 0 && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  style={{ background: '#F59E0B', color: '#1C1708' }}
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer: company name → profile + sign out */}
      <div className="px-4 py-4 border-t" style={{ borderColor: '#2D3F52' }}>
        <Link
          href="/supplier-portal/profile"
          className="flex items-center gap-2 mb-3 group rounded-lg px-2 py-1.5 -mx-2 transition-colors"
          style={{ color: '#A8C4DC' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
            style={{ background: '#2D4159', color: '#5BA3DC' }}
          >
            {companyName.charAt(0).toUpperCase()}
          </div>
          <p className="text-xs font-medium truncate flex-1">{companyName}</p>
          <User size={11} style={{ color: '#4A7FA5' }} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
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
