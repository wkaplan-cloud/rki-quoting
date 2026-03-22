export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: settings } = await supabase.from('settings').select('*').eq('user_id', user!.id).maybeSingle()

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure your business details and defaults" />
      <div className="p-8 max-w-xl">
        <SettingsForm settings={settings} userId={user!.id} />
      </div>
    </div>
  )
}
