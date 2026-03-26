export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: member } = await supabaseAdmin
    .from('org_members')
    .select('full_name')
    .eq('user_id', user!.id)
    .maybeSingle()

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your personal account details" />
      <div className="p-8 max-w-sm">
        <SettingsForm currentFullName={member?.full_name ?? ''} />
      </div>
    </div>
  )
}
