export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { SessionExpiredHandler } from '@/components/SessionExpiredHandler'
import { PlatformShell, type NavSection } from './_components/PlatformShell'

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

  // Sidebar badges — count-only queries so every platform page stays cheap.
  const [{ count: pendingPriceListCount }, { count: unreadMessageCount }] = await Promise.all([
    supabaseAdmin.from('price_list_access').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('contact_submissions').select('id', { count: 'exact', head: true }).eq('read', false),
  ])

  const sections: NavSection[] = [
    {
      key: 'designer',
      label: 'Designer Portal',
      icon: 'Palette',
      accent: 'text-[#D8BA84]',
      dot: 'bg-[#D8BA84]',
      items: [
        { href: '/platform',              label: 'Overview',       icon: 'LayoutDashboard' },
        { href: '/platform/studios',      label: 'Studios',        icon: 'Building2' },
        { href: '/platform/sourcing',     label: 'Price Requests', icon: 'ArrowLeftRight' },
        { href: '/platform/price-lists',  label: 'Price Lists',    icon: 'BookOpen', badge: pendingPriceListCount ?? 0 },
        { href: '/platform/messages',     label: 'Messages',       icon: 'MessageSquare', badge: unreadMessageCount ?? 0 },
        { href: '/platform/broadcast',    label: 'Broadcast',      icon: 'Radio' },
        { href: '/platform/commissions',  label: 'Commissions',    icon: 'BadgeDollarSign' },
      ],
    },
    {
      // Three portals, one list. Each item keeps its own hue because the group
      // is a container, not a portal in its own right.
      key: 'accounts',
      label: 'Portal Accounts',
      icon: 'Package',
      accent: 'text-teal-300',
      dot: 'bg-teal-300',
      items: [
        { href: '/platform/suppliers',     label: 'All Accounts',        icon: 'Store', accent: 'text-teal-300' },
        { href: '/platform/manufacturing', label: 'Manufacturing',       icon: 'Hammer', accent: 'text-orange-300' },
        { href: '/platform/electricians',  label: 'Electrical & Trades', icon: 'Zap',    accent: 'text-violet-300' },
      ],
    },
    {
      key: 'system',
      label: 'System',
      icon: 'Activity',
      accent: 'text-[#B4B0A6]',
      dot: 'bg-[#B4B0A6]',
      items: [
        { href: '/platform/health', label: 'Health', icon: 'Activity' },
      ],
    },
  ]

  return (
    <PlatformShell sections={sections} adminEmail={user.email ?? ''}>
      <SessionExpiredHandler loginPath="/login?from=platform" />
      {children}
    </PlatformShell>
  )
}
