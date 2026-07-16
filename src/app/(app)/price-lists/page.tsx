export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { PriceListsManager } from './PriceListsManager'

export default async function PriceListsPage() {
  const supabase = await createClient()

  const [{ data: priceLists }, { data: orgId }, { data: { user } }] = await Promise.all([
    supabase.from('price_lists').select('*').order('created_at', { ascending: false }),
    supabase.rpc('get_current_org_id'),
    supabase.auth.getUser(),
  ])

  const platformAdmin = process.env.PLATFORM_ADMIN_EMAIL
  const isPlatformAdmin = !!(user && platformAdmin && user.email === platformAdmin)

  // Org admins manage their own studio's price lists
  const [{ data: membership }, { data: accessRecords }] = await Promise.all([
    user
      ? supabaseAdmin.from('org_members').select('role').eq('user_id', user.id).eq('status', 'active').maybeSingle()
      : Promise.resolve({ data: null }),
    orgId
      ? supabaseAdmin.from('price_list_access').select('price_list_id, status').eq('org_id', orgId)
      : Promise.resolve({ data: [] }),
  ])

  const canManage = isPlatformAdmin || membership?.role === 'admin'

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Price Lists"
        subtitle="Browse supplier price lists and manage your own"
        count={priceLists?.length}
      />
      <div className="p-8">
        <PriceListsManager
          priceLists={priceLists ?? []}
          canManage={canManage}
          accessRecords={accessRecords ?? []}
          currentOrgId={orgId ?? null}
        />
      </div>
    </div>
  )
}
