export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // First-time user — send to onboarding
  const { data: settings } = await supabase.from('settings').select('id').eq('user_id', user.id).maybeSingle()
  if (!settings) redirect('/onboarding')

  return <AppLayout>{children}</AppLayout>
}
