'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Users, Truck, Package, Settings, LogOut, ShieldCheck, Upload, BookOpen, X
} from 'lucide-react'

const mainLinks = [
  { href: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects',  icon: FolderOpen },
]

const secondaryLinks = [
  { href: '/clients',     label: 'Clients',     icon: Users },
  { href: '/suppliers',   label: 'Suppliers',   icon: Truck },
  { href: '/items',       label: 'Items',       icon: Package },
  { href: '/price-lists', label: 'Price Lists', icon: BookOpen },
]

interface Props {
  isAdmin: boolean
  businessName: string
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isAdmin, businessName, isOpen, onClose }: Props) {
  const path = usePathname()

  const isActive = (href: string) =>
    href === '/' ? path === '/' : path.startsWith(href)

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      <aside
        className={`w-44 flex-shrink-0 bg-[#1A1A18] flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-200
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Mobile close button */}
        <div className="md:hidden flex justify-end px-3 pt-3 pb-1">
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="w-28 object-contain" style={{ filter: 'invert(1)' }} />
          {businessName && (
            <span className="text-[10px] font-medium text-[#C4A46B] uppercase tracking-widest text-center leading-tight">
              {businessName}
            </span>
          )}
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {mainLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors duration-150
                ${isActive(href)
                  ? 'bg-[#9A7B4F]/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
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
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-colors duration-150
                ${isActive(href)
                  ? 'text-white/80'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
              <Icon size={14} className={isActive(href) ? 'text-[#C4A46B]' : 'opacity-60'} />
              {label}
            </Link>
          ))}
          <Link href="/import" onClick={onClose} className={`flex items-center gap-3 px-3 py-2 rounded text-xs transition-colors duration-150 ${isActive('/import') ? 'text-white/80' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
            <Upload size={14} className={isActive('/import') ? 'text-[#C4A46B]' : 'opacity-60'} />
            Import
          </Link>
          <div className="border-t border-white/10 my-1" />
          {isAdmin && (
            <Link href="/admin" onClick={onClose} className="flex items-center gap-3 px-3 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors">
              <ShieldCheck size={14} />
              Admin
            </Link>
          )}
          <Link href="/settings" onClick={onClose} className="flex items-center gap-3 px-3 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            <Settings size={14} />
            Settings
          </Link>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="flex items-center gap-3 px-3 py-2 rounded text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors w-full text-left cursor-pointer">
              <LogOut size={14} />
              Sign Out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
