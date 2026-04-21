export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsForm } from './SettingsForm'
import { StudioSettingsForm } from '../admin/StudioSettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: orgId } = await supabase.rpc('get_current_org_id')

  const [{ data: member }, { data: settings }, { data: org }] = await Promise.all([
    supabaseAdmin.from('org_members').select('full_name').eq('user_id', user!.id).maybeSingle(),
    supabase.from('settings').select('*').maybeSingle(),
    orgId ? supabaseAdmin.from('organizations').select('plan').eq('id', orgId).single() : Promise.resolve({ data: null }),
  ])

  const meta = (user?.user_metadata ?? {}) as Record<string, string>
  const plan = org?.plan ?? 'trial'

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile and studio configuration" />
      <div className="p-8 space-y-12 max-w-5xl">
        <section>
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-6">Your Profile</h2>
          <div className="max-w-lg">
            <SettingsForm
              currentFullName={member?.full_name ?? meta.full_name ?? ''}
              email={user?.email ?? ''}
              currentPhone={meta.phone ?? ''}
              currentJobTitle={meta.job_title ?? ''}
            />
          </div>
        </section>

        <section className="border-t border-[#EDE9E1] pt-10">
          <h2 className="text-xs font-medium text-[#8A877F] uppercase tracking-wider mb-6">Studio Settings</h2>
          <StudioSettingsForm settings={settings as any} plan={plan} />
        </section>

        {/* Upsell nudges */}
        {plan === 'solo' && (
          <p className="text-xs text-[#8A877F] border-t border-[#EDE9E1] pt-6">
            Need to add team members?{' '}
            <a href="/subscribe" className="text-[#9A7B4F] hover:underline">Upgrade to Studio</a>
            {' '}for up to 5 users, shared projects, and full pipeline analytics.
          </p>
        )}
        {plan === 'studio' && (
          <p className="text-xs text-[#8A877F] border-t border-[#EDE9E1] pt-6">
            Want Sage accounting integration and custom branded PDFs?{' '}
            <a href="/subscribe" className="text-[#9A7B4F] hover:underline">Upgrade to Agency</a>
            {' '}for unlimited team members too.
          </p>
        )}
      </div>
    </div>
  )
}
