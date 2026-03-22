export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Try to accept any pending invite first (security definer bypasses RLS)
  await supabase.rpc('accept_org_invite')

  // Check org membership via RPC (security definer — bypasses RLS circular dependency)
  const { data: orgId } = await supabase.rpc('get_current_org_id')

  if (!orgId) {
    redirect('/onboarding')
  }

  return <AppLayout>{children}</AppLayout>
}
