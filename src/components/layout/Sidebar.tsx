'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, FolderOpen, Users, Truck, Settings, LogOut, ShieldCheck, BookOpen, X, MessageSquare, Calculator, ArrowUpCircle, LayoutGrid, Lock, PanelLeft, PanelLeftClose, Hotel, Presentation, ReceiptText,
} from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'

const mainLinks = [
  { href: '/dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/projects',  label: 'Projects',   icon: FolderOpen, tourId: 'nav-projects' },
  { href: '/pieces',    label: 'Our Pieces', icon: LayoutGrid, soloLocked: true },
]

const secondaryLinks = [
  { href: '/clients',     label: 'Clients',     icon: Users,     tourId: 'nav-clients' },
  { href: '/suppliers',   label: 'Suppliers',   icon: Truck,     tourId: 'nav-suppliers' },
  { href: '/price-lists', label: 'Price Lists', icon: BookOpen },
  { href: '/quotes',      label: 'Quotes',      icon: ReceiptText },
]

interface Props {
  isAdmin?: boolean
  businessName: string
  capitalHotelsEnabled?: boolean
  capitalBadge?: number
  studioEnabled?: boolean
  isOpen: boolean
  onClose: () => void
  onContactClick: () => void
  plan: string
  subscriptionStatus: string
  trialDaysLeft: number | null
  desktopExpanded: boolean
  onDesktopToggle: () => void
}

export function Sidebar({ isAdmin, businessName, capitalHotelsEnabled = false, capitalBadge = 0, studioEnabled = false, isOpen, onClose, onContactClick, plan, subscriptionStatus, trialDaysLeft, desktopExpanded, onDesktopToggle }: Props) {
  const path = usePathname()
  const isActive = (href: string) =>
    href === '/dashboard' ? path === '/dashboard' : path.startsWith(href)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [upgradeAgencyModalOpen, setUpgradeAgencyModalOpen] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  async function handleUpgrade(planId: 'studio' | 'agency') {
    setUpgrading(true)
    try {
      const res = await fetch('/api/paystack/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Something went wrong'); return }
      window.location.href = data.authorization_url
    } finally {
      setUpgrading(false)
    }
  }

  // Shared label style: always visible on mobile, visible on desktop only when expanded
  const labelCls = `text-xs whitespace-nowrap transition-opacity duration-150 pr-3 ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`

  return (
    <>
      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}

      <aside
        data-tour="sidebar"
        className={`group bg-[#1A1A18] flex flex-col h-screen fixed left-0 top-0 z-50 overflow-hidden md:transition-[width] md:duration-200
          w-44 ${desktopExpanded ? 'md:w-44' : 'md:w-12 md:hover:w-44'}
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Mobile close */}
        <div className="md:hidden flex justify-end px-3 pt-3 pb-1">
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Logo */}
        <div className="flex-shrink-0 relative border-b border-white/10">
          {/* Desktop: expand button — visible only when collapsed */}
          <button
            onClick={onDesktopToggle}
            className={`hidden md:flex absolute inset-0 items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors z-10 ${desktopExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100 md:group-hover:opacity-0'}`}
            aria-label="Pin navigation open"
          >
            <PanelLeft size={15} />
          </button>
          {/* Desktop: collapse button — visible only when expanded */}
          <button
            onClick={onDesktopToggle}
            className={`hidden md:flex absolute top-3 right-3 w-6 h-6 items-center justify-center rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors z-10 ${desktopExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none md:group-hover:opacity-100'}`}
            aria-label="Unpin navigation"
          >
            <PanelLeftClose size={15} />
          </button>
          {/* Full logo: always on mobile, visible on desktop when expanded */}
          <div className={`px-4 py-5 flex flex-col items-center transition-opacity duration-150 ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:pointer-events-none'}`}>
            <Image src="/logo.png" alt="QuotingHub" width={96} height={96} className="w-24 h-auto object-contain" style={{ filter: 'invert(1)' }} />
            {businessName && (
              <span className="text-[9px] font-medium text-[#C4A46B] uppercase tracking-widest whitespace-nowrap mt-2 text-center">
                {businessName}
              </span>
            )}
            <NotificationBell />
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 pt-4 pb-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {mainLinks.map(({ href, label, icon: Icon, soloLocked, tourId }: { href: string; label: string; icon: any; soloLocked?: boolean; tourId?: string }) => {
            if (soloLocked && plan === 'solo') {
              return (
                <button
                  key={href}
                  onClick={() => setUpgradeModalOpen(true)}
                  className="flex items-center h-9 rounded mx-1 transition-colors duration-150 text-white/40 hover:text-white/60 hover:bg-white/5 w-[calc(100%-8px)]"
                >
                  <span className="flex items-center justify-center w-10 flex-shrink-0">
                    <Icon size={16} className="opacity-30" />
                  </span>
                  <span className={`text-sm whitespace-nowrap transition-opacity duration-150 pr-3 flex items-center gap-1.5 ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                    {label} <Lock size={10} className="opacity-40" />
                  </span>
                </button>
              )
            }
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                data-tour={tourId}
                className={`flex items-center h-9 rounded mx-1 transition-colors duration-150
                  ${isActive(href)
                    ? 'bg-[#9A7B4F]/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'}`}
              >
                <span className="flex items-center justify-center w-10 flex-shrink-0">
                  <Icon size={16} className={isActive(href) ? 'text-[#C4A46B]' : 'opacity-60'} />
                </span>
                <span className={`text-sm whitespace-nowrap transition-opacity duration-150 pr-3 ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                  {label}
                </span>
              </Link>
            )
          })}

          <div className="border-t border-white/10 my-2 mx-2" />

          {secondaryLinks.map(({ href, label, icon: Icon, tourId }: { href: string; label: string; icon: any; tourId?: string }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              data-tour={tourId}
              className={`flex items-center h-8 rounded mx-1 transition-colors duration-150
                ${isActive(href)
                  ? 'text-white/80'
                  : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <Icon size={14} className={isActive(href) ? 'text-[#C4A46B]' : 'opacity-60'} />
              </span>
              <span className={labelCls}>{label}</span>
            </Link>
          ))}

          {plan === 'solo' ? (
            <button
              onClick={() => setUpgradeModalOpen(true)}
              className="flex items-center h-8 rounded mx-1 transition-colors duration-150 text-white/30 hover:text-white/50 hover:bg-white/5 w-[calc(100%-8px)]"
            >
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <Calculator size={14} className="opacity-30" />
              </span>
              <span className={`${labelCls} flex items-center gap-1.5`}>Markup Calculator <Lock size={9} className="opacity-40" /></span>
            </button>
          ) : (
            <Link
              href="/markup-calculator"
              onClick={onClose}
              className={`flex items-center h-8 rounded mx-1 transition-colors duration-150
                ${isActive('/markup-calculator')
                  ? 'text-white/80'
                  : 'text-white/50 hover:text-white hover:bg-white/5'}`}
            >
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <Calculator size={14} className={isActive('/markup-calculator') ? 'text-[#C4A46B]' : 'opacity-60'} />
              </span>
              <span className={labelCls}>Markup Calculator</span>
            </Link>
          )}


          {studioEnabled && (
            <>
              <div className="border-t border-white/10 my-2 mx-2" />
              <Link
                href="/studio"
                onClick={onClose}
                className={`flex items-center h-9 rounded mx-1 transition-colors duration-150
                  ${isActive('/studio')
                    ? 'bg-[#9A7B4F]/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'}`}
              >
                <span className="flex items-center justify-center w-10 flex-shrink-0">
                  <Presentation size={15} className={isActive('/studio') ? 'text-[#C4A46B]' : 'opacity-60'} />
                </span>
                <span className={`text-sm whitespace-nowrap transition-opacity duration-150 ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                  Studio
                </span>
              </Link>
            </>
          )}

          {capitalHotelsEnabled && (
            <>
              <div className="border-t border-white/10 my-2 mx-2" />
              <Link
                href="/capital-hotels"
                onClick={onClose}
                className={`flex items-center h-9 rounded mx-1 transition-colors duration-150
                  ${isActive('/capital-hotels')
                    ? 'bg-[#9A7B4F]/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'}`}
              >
                <span className="flex items-center justify-center w-10 flex-shrink-0">
                  <Hotel size={15} className={isActive('/capital-hotels') ? 'text-[#C4A46B]' : 'opacity-60'} />
                </span>
                <span className={`text-sm whitespace-nowrap transition-opacity duration-150 ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                  Capital Hotels
                </span>
                {capitalBadge > 0 && (
                  <span className={`transition-opacity duration-150 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center bg-blue-500 text-white ${desktopExpanded ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                    {capitalBadge > 99 ? '99+' : capitalBadge}
                  </span>
                )}
              </Link>
              <Link
                href="/capital-pieces"
                onClick={onClose}
                className={`flex items-center h-8 rounded mx-1 transition-colors duration-150
                  ${isActive('/capital-pieces')
                    ? 'text-white/80'
                    : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              >
                <span className="flex items-center justify-center w-10 flex-shrink-0">
                  <LayoutGrid size={14} className={isActive('/capital-pieces') ? 'text-[#C4A46B]' : 'opacity-60'} />
                </span>
                <span className={labelCls}>Capital Pieces</span>
              </Link>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="flex-shrink-0 py-2 border-t border-white/10 space-y-0.5">
          {plan === 'solo' && (
            <Link href="/settings" onClick={onClose}
              className="flex items-center h-8 rounded mx-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <ShieldCheck size={14} />
              </span>
              <span className={labelCls}>Admin</span>
            </Link>
          )}


          {plan !== 'solo' && (
            <Link href="/admin" onClick={onClose} 
              className="flex items-center h-8 rounded mx-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <ShieldCheck size={14} />
              </span>
              <span className={labelCls}>Admin</span>
            </Link>
          )}

          <button
            onClick={() => { onContactClick(); onClose() }}
            
            className="flex items-center h-8 rounded mx-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors w-[calc(100%-8px)]"
          >
            <span className="flex items-center justify-center w-10 flex-shrink-0">
              <MessageSquare size={14} />
            </span>
            <span className={labelCls}>Contact</span>
          </button>

          {/* Subscription status */}
          {subscriptionStatus === 'active' ? (
            plan === 'solo' ? (
              <button
                onClick={() => setUpgradeModalOpen(true)}
                
                className="flex items-center h-7 rounded mx-1 hover:bg-white/5 transition-colors w-[calc(100%-8px)] group/upgrade"
              >
                <span className="flex items-center justify-center w-10 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className={`${labelCls} text-white/30 capitalize group-hover/upgrade:text-white/60 transition-colors`}>
                  Solo plan
                  <ArrowUpCircle size={10} className="inline ml-1 opacity-0 group-hover/upgrade:opacity-60 transition-opacity" />
                </span>
              </button>
            ) : plan === 'studio' ? (
              <button
                onClick={() => setUpgradeAgencyModalOpen(true)}
                
                className="flex items-center h-7 rounded mx-1 hover:bg-white/5 transition-colors w-[calc(100%-8px)] group/upgrade"
              >
                <span className="flex items-center justify-center w-10 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className={`${labelCls} text-white/30 capitalize group-hover/upgrade:text-white/60 transition-colors`}>
                  Studio plan
                  <ArrowUpCircle size={10} className="inline ml-1 opacity-0 group-hover/upgrade:opacity-60 transition-opacity" />
                </span>
              </button>
            ) : (
              <div className="flex items-center h-7 mx-1">
                <span className="flex items-center justify-center w-10 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className={`${labelCls} text-white/30 capitalize`}>{plan} plan</span>
              </div>
            )
          ) : subscriptionStatus === 'trialing' && trialDaysLeft !== null ? (
            <Link href="/subscribe" onClick={onClose}
              className={`flex items-center h-7 rounded mx-1 hover:bg-white/5 transition-colors ${trialDaysLeft <= 5 ? 'text-amber-400' : 'text-white/40'}`}>
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${trialDaysLeft <= 5 ? 'bg-amber-400' : 'bg-[#C4A46B]'}`} />
              </span>
              <span className={`${labelCls} uppercase tracking-wider text-[10px]`}>
                {trialDaysLeft === 0 ? 'Trial ended' : `Trial · ${trialDaysLeft}d left`}
              </span>
            </Link>
          ) : null}

          <form action="/api/auth/signout" method="post">
            <button type="submit" 
              className="flex items-center h-8 rounded mx-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors w-[calc(100%-8px)]">
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <LogOut size={14} />
              </span>
              <span className={labelCls}>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>
      {/* Upgrade to Studio modal */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setUpgradeModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[360px] p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#1A1A18]">Upgrade to Studio</h2>
              <button onClick={() => setUpgradeModalOpen(false)} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-[#8A877F] leading-relaxed mb-5">
              Studio unlocks your full workflow — team collaboration, advanced pipeline analytics, and internal production tools. Your card will be charged <strong className="text-[#2C2C2A]">R1,499/month</strong> starting today.
            </p>
            <ul className="space-y-2 mb-6">
              {['Our Pieces — save your design library with specs, images and pricing', 'Up to 5 team members with role permissions', 'Full pipeline dashboard + Kanban board', 'Job Cost Sheet PDF for internal use', 'Markup Calculator & bulk import tools', 'Profit analytics per project & per year'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#2C2C2A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A7B4F] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleUpgrade('studio')}
                disabled={upgrading}
                className="w-full py-3 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer font-medium"
              >
                {upgrading ? 'Redirecting…' : 'Upgrade to Studio →'}
              </button>
              <button
                onClick={() => setUpgradeModalOpen(false)}
                className="w-full py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade to Agency modal */}
      {upgradeAgencyModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setUpgradeAgencyModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-[360px] p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#1A1A18]">Upgrade to Agency</h2>
              <button onClick={() => setUpgradeAgencyModalOpen(false)} className="text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-[#8A877F] leading-relaxed mb-5">
              Agency removes all limits — unlimited team members, Sage accounting integration, and custom branded PDFs matched to your letterhead. Your card will be charged <strong className="text-[#2C2C2A]">R2,499/month</strong> starting today.
            </p>
            <ul className="space-y-2 mb-6">
              {['Unlimited team members', 'Sage Business Cloud Accounting integration', 'Custom branded PDFs — we match your letterhead', 'Everything in Studio'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#2C2C2A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A7B4F] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleUpgrade('agency')}
                disabled={upgrading}
                className="w-full py-3 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer font-medium"
              >
                {upgrading ? 'Redirecting…' : 'Upgrade to Agency →'}
              </button>
              <button
                onClick={() => setUpgradeAgencyModalOpen(false)}
                className="w-full py-2 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
