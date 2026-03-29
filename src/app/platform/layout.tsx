export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Building2, MessageSquare, BookOpen, LogOut } from 'lucide-react'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    redirect('/login')
  }

  // Require MFA (aal2) for platform admin access
  const { data: mfa } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!mfa || mfa.nextLevel === 'aal1') {
    // No MFA factor enrolled yet — force setup
    redirect('/mfa/enroll')
  }
  if (mfa.currentLevel !== 'aal2') {
    // MFA enrolled but not yet verified this session
    redirect('/mfa/challenge')
  }

  const navItems = [
    { href: '/platform', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/platform/studios', label: 'Studios', icon: Building2 },
    { href: '/platform/messages', label: 'Messages', icon: MessageSquare },
    { href: '/platform/price-lists', label: 'Price Lists', icon: BookOpen },
  ]

  return (
    <div className="min-h-screen bg-[#0F0F0D] text-white flex">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 bg-[#1A1A18] flex flex-col h-screen fixed left-0 top-0 border-r border-white/10">
        <div className="px-5 py-6 border-b border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-12 w-auto object-contain mb-1" style={{ filter: 'invert(1)' }} />
          <span className="text-[10px] font-medium text-[#C4A46B] uppercase tracking-widest">Platform Admin</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Icon size={15} className="opacity-60" />
              {label}
            </Link>
          ))}
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
