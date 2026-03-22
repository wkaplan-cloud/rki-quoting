'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Users, Truck, Package, Settings, LogOut, ShieldCheck
} from 'lucide-react'

const mainLinks = [
  { href: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects',  icon: FolderOpen },
]

const secondaryLinks = [
  { href: '/clients',   label: 'Clients',   icon: Users },
  { href: '/suppliers', label: 'Suppliers', icon: Truck },
  { href: '/items',     label: 'Items',     icon: Package },
]

export function Sidebar() {
  const path = usePathname()

  const isActive = (href: string) =>
    href === '/' ? path === '/' : path.startsWith(href)

  return (
    <aside className="w-56 flex-shrink-0 bg-[#1A1A18] flex flex-col h-screen fixed left-0 top-0 z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="font-serif text-lg text-white tracking-tight leading-tight">
          R Kaplan
          <span className="block text-[#C4A46B] text-xs font-sans font-normal tracking-widest uppercase mt-0.5">
            Interiors
          </span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {mainLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors duration-150
              ${isActive(href)
                ? 'bg-[#9A7B4F]/20 text-white'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
          >
            <Icon size={16} className={isActive(href) ? 'text-[#C4A46B]' : 'opacity-60'} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-white/10 space-y-0.5">
        {secondaryLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-colors duration-150
              ${isActive(href)
                ? 'text-white/80'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}
          >
            <Icon size={14} className={isActive(href) ? 'text-[#C4A46B]' : 'opacity-60'} />
            {label}
          </Link>
        ))}
        <div className="border-t border-white/10 my-1" />
        <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
          <ShieldCheck size={14} />
          Admin
        </Link>
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
          <Settings size={14} />
          Settings
        </Link>
        <form action="/api/auth/signout" method="post">
          <button type="submit" className="flex items-center gap-3 px-3 py-2 rounded text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors w-full text-left cursor-pointer">
            <LogOut size={14} />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  )
}
