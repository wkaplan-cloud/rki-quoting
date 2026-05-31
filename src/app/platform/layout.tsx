export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Building2, MessageSquare, BookOpen, LogOut,
  ArrowLeftRight, Store, FolderOpen, Activity, BadgeDollarSign,
  Radio, Zap, Palette, Package,
} from 'lucide-react'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    redirect('/login?from=platform')
  }

  // Require MFA (aal2) for platform admin access
  const { data: mfa } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!mfa || mfa.nextLevel === 'aal1') {
    redirect('/mfa/enroll')
  }
  if (mfa.currentLevel !== 'aal2') {
    redirect('/mfa/challenge')
  }

  const { count: pendingPriceListCount } = await supabaseAdmin
    .from('price_list_access')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const portalSections = [
    {
      key: 'designer',
      label: 'Designer Portal',
      icon: Palette,
      color: 'text-[#C4A46B]',
      items: [
        { href: '/platform',             label: 'Dashboard',    icon: LayoutDashboard, badge: 0 },
        { href: '/platform/studios',     label: 'Studios',      icon: Building2,       badge: 0 },
        { href: '/platform/quotes',      label: 'Quotes',       icon: FolderOpen,      badge: 0 },
        { href: '/platform/messages',    label: 'Messages',     icon: MessageSquare,   badge: 0 },
        { href: '/platform/broadcast',   label: 'Broadcast',    icon: Radio,           badge: 0 },
        { href: '/platform/commissions', label: 'Commissions',  icon: BadgeDollarSign, badge: 0 },
      ],
    },
    {
      key: 'supplier',
      label: 'Supplier Portal',
      icon: Package,
      color: 'text-blue-400',
      items: [
        { href: '/platform/suppliers',   label: 'Suppliers',    icon: Store,           badge: 0 },
        { href: '/platform/sourcing',    label: 'Sourcing',     icon: ArrowLeftRight,  badge: 0 },
        { href: '/platform/price-lists', label: 'Price Lists',  icon: BookOpen,        badge: pendingPriceListCount ?? 0 },
      ],
    },
    {
      key: 'electrician',
      label: 'Electrician Portal',
      icon: Zap,
      color: 'text-amber-400',
      items: [
        { href: '/platform/electricians', label: 'Contractors', icon: Zap,      badge: 0 },
        { href: '/platform/health',        label: 'Health',     icon: Activity, badge: 0 },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-[#0F0F0D] text-white flex">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-[#1A1A18] flex flex-col h-screen fixed left-0 top-0 border-r border-white/10">
        <div className="px-5 py-5 border-b border-white/10 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="w-28 h-auto object-contain mb-2" style={{ filter: 'invert(1)' }} />
          <span className="text-[10px] font-medium text-[#C4A46B] uppercase tracking-widest">Platform Admin</span>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
          {portalSections.map(section => {
            const SectionIcon = section.icon
            return (
              <div key={section.key}>
                {/* Section header */}
                <div className={`flex items-center gap-1.5 px-3 mb-1 ${section.color}`}>
                  <SectionIcon size={10} />
                  <span className="text-[9px] font-bold uppercase tracking-widest">{section.label}</span>
                </div>

                {/* Section nav items */}
                <div className="space-y-0.5">
                  {section.items.map(({ href, label, icon: Icon, badge }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 px-3 py-2 rounded text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Icon size={14} className="opacity-60 flex-shrink-0" />
                      <span className="flex-1 text-xs">{label}</span>
                      {badge > 0 && (
                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#9A7B4F] text-white min-w-[18px] text-center">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>

                <div className="mt-3 border-t border-white/5" />
              </div>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="flex items-center gap-3 px-3 py-2 rounded text-xs text-white/40 hover:text-white hover:bg-white/5 transition-colors w-full text-left cursor-pointer">
              <LogOut size={14} />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-52 flex-1 flex flex-col min-h-screen">
        {children}
      </main>
    </div>
  )
}
