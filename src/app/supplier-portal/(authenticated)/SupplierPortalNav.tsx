'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, List, LogOut } from 'lucide-react'

interface Props {
  companyName: string
}

export function SupplierPortalNav({ companyName }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/supplier-portal/login')
  }

  const navItems = [
    { href: '/supplier-portal/dashboard', label: 'Price Requests', icon: <Package size={14} /> },
    { href: '/supplier-portal/price-list', label: 'My Price List', icon: <List size={14} /> },
  ]

  return (
    <header className="bg-[#2C2C2A] border-b border-black/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/supplier-portal/dashboard" className="flex items-center gap-3 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-6 w-auto object-contain" style={{ filter: 'invert(1) brightness(0.8)' }} />
          <span className="text-xs text-white/30 font-medium hidden sm:block">Supplier Portal</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 flex-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Company name + sign out */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-white/40 truncate max-w-[140px] hidden sm:block">{companyName}</span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  )
}
