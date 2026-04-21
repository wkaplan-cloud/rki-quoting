'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, FolderOpen, Users, Truck, Package, Settings, LogOut, ShieldCheck, Upload, BookOpen, X, MessageSquare, Calculator, Tag, ArrowUpCircle
} from 'lucide-react'

const mainLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects',  label: 'Projects',  icon: FolderOpen },
]

const secondaryLinks = [
  { href: '/clients',            label: 'Clients',            icon: Users },
  { href: '/suppliers',          label: 'Suppliers',          icon: Truck },
  { href: '/items',              label: 'Items',              icon: Package },
  { href: '/price-lists',        label: 'Price Lists',        icon: BookOpen },
]

interface Props {
  isAdmin: boolean
  businessName: string
  sourcingEnabled: boolean
  isOpen: boolean
  onClose: () => void
  onContactClick: () => void
  plan: string
  subscriptionStatus: string
  trialDaysLeft: number | null
}

export function Sidebar({ isAdmin, businessName, sourcingEnabled, isOpen, onClose, onContactClick, plan, subscriptionStatus, trialDaysLeft }: Props) {
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

  // Shared label style: always visible on mobile, fade in on desktop hover
  const labelCls = 'text-xs whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 pr-3'

  return (
    <>
      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}

      <aside
        className={`group bg-[#1A1A18] flex flex-col h-screen fixed left-0 top-0 z-50 overflow-hidden
          w-44 md:w-12 md:hover:w-44 md:transition-[width] md:duration-200
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
          {/* Q mark: desktop collapsed only — fades out on expand */}
          <span className="hidden md:flex md:group-hover:opacity-0 absolute inset-0 items-center justify-center text-[#C4A46B] font-bold text-base select-none transition-opacity duration-150 pointer-events-none">
            Q
          </span>
          {/* Full logo: always on mobile, fades in on desktop hover */}
          <div className="px-4 py-5 flex flex-col items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="QuotingHub" className="w-24 h-auto object-contain" style={{ filter: 'invert(1)' }} />
            {businessName && (
              <span className="text-[9px] font-medium text-[#C4A46B] uppercase tracking-widest whitespace-nowrap mt-2 text-center">
                {businessName}
              </span>
            )}
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 pt-4 pb-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {mainLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={label}
              className={`flex items-center h-9 rounded mx-1 transition-colors duration-150
                ${isActive(href)
                  ? 'bg-[#9A7B4F]/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'}`}
            >
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <Icon size={16} className={isActive(href) ? 'text-[#C4A46B]' : 'opacity-60'} />
              </span>
              <span className={`text-sm whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 pr-3`}>
                {label}
              </span>
            </Link>
          ))}

          <div className="border-t border-white/10 my-2 mx-2" />

          {secondaryLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={label}
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

          {plan !== 'solo' && (
            <Link
              href="/markup-calculator"
              onClick={onClose}
              title="Markup Calculator"
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

          {sourcingEnabled && plan !== 'solo' && (
            <>
              <div className="border-t border-white/10 my-2 mx-2" />
              <Link
                href="/sourcing"
                onClick={onClose}
                title="Request Price"
                className={`flex items-center h-9 rounded mx-1 transition-colors duration-150
                  ${isActive('/sourcing')
                    ? 'bg-[#9A7B4F]/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'}`}
              >
                <span className="flex items-center justify-center w-10 flex-shrink-0">
                  <Tag size={15} className={isActive('/sourcing') ? 'text-[#C4A46B]' : 'opacity-60'} />
                </span>
                <span className={`text-sm whitespace-nowrap opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 pr-3`}>
                  Request Price
                </span>
              </Link>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="flex-shrink-0 py-2 border-t border-white/10 space-y-0.5">
          <Link href="/settings" onClick={onClose} title="Profile"
            className="flex items-center h-8 rounded mx-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors">
            <span className="flex items-center justify-center w-10 flex-shrink-0">
              <Settings size={14} />
            </span>
            <span className={labelCls}>Profile</span>
          </Link>

          {plan !== 'solo' && (
            <Link href="/import" onClick={onClose} title="Import"
              className="flex items-center h-8 rounded mx-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <Upload size={14} />
              </span>
              <span className={labelCls}>Import</span>
            </Link>
          )}

          {isAdmin && plan !== 'solo' && (
            <Link href="/admin" onClick={onClose} title="Admin"
              className="flex items-center h-8 rounded mx-1 text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              <span className="flex items-center justify-center w-10 flex-shrink-0">
                <ShieldCheck size={14} />
              </span>
              <span className={labelCls}>Admin</span>
            </Link>
          )}

          <button
            onClick={() => { onContactClick(); onClose() }}
            title="Contact"
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
                title="Upgrade to Studio"
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
                title="Upgrade to Agency"
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
              title={trialDaysLeft === 0 ? 'Trial ended' : `Trial · ${trialDaysLeft}d left`}
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
            <button type="submit" title="Sign Out"
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
              Studio gives you up to 5 team members, shared project collaboration, and Price Requests. Your card will be charged <strong className="text-[#2C2C2A]">R1,499/month</strong> starting today.
            </p>
            <ul className="space-y-2 mb-6">
              {['Up to 5 team members', 'Shared projects & live collaboration', 'Request Price — send sourcing requests to suppliers'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#2C2C2A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A7B4F] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setUpgradeModalOpen(false)}
                className="flex-1 py-2.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpgrade('studio')}
                disabled={upgrading}
                className="flex-1 py-2.5 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer font-medium"
              >
                {upgrading ? 'Redirecting…' : 'Upgrade to Studio →'}
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
              Agency gives you unlimited team members and custom branded PDFs — we match your existing letterhead so every document looks like yours. Your card will be charged <strong className="text-[#2C2C2A]">R2,499/month</strong> starting today.
            </p>
            <ul className="space-y-2 mb-6">
              {['Unlimited team members', 'Custom branded PDFs — we match your letterhead', 'Everything in Studio'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#2C2C2A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A7B4F] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={() => setUpgradeAgencyModalOpen(false)}
                className="flex-1 py-2.5 text-sm text-[#8A877F] hover:text-[#2C2C2A] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpgrade('agency')}
                disabled={upgrading}
                className="flex-1 py-2.5 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#9A7B4F] transition-colors disabled:opacity-50 cursor-pointer font-medium"
              >
                {upgrading ? 'Redirecting…' : 'Upgrade to Agency →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
