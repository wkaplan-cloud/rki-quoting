export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check if user has an active org membership
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!membership) {
    // Check if they were invited by email — auto-accept
    const { data: pending } = await supabase
      .from('org_members')
      .select('id')
      .eq('invited_email', user.email!)
      .eq('status', 'pending')
      .maybeSingle()

    if (pending) {
      // Accept invite via security-definer function
      await supabase.rpc('accept_org_invite')
    } else {
      // Brand new user — send to onboarding
      redirect('/onboarding')
    }
  }

  return <AppLayout>{children}</AppLayout>
}
