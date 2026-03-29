export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PageHeader } from '@/components/layout/PageHeader'
import { PriceListsManager } from './PriceListsManager'

export default async function PriceListsPage() {
  const supabase = await createClient()

  const [{ data: priceLists }, { data: orgId }] = await Promise.all([
    supabase.from('price_lists').select('id, name, supplier_name, item_count, created_at, is_global').order('created_at', { ascending: false }),
    supabase.rpc('get_current_org_id'),
  ])

  const { data: { user } } = await supabase.auth.getUser()
  const platformAdmin = process.env.PLATFORM_ADMIN_EMAIL
  const canManage = !!(user && platformAdmin && user.email === platformAdmin)

  // Fetch this org's access records for global price lists
  const { data: accessRecords } = orgId
    ? await supabaseAdmin.from('price_list_access').select('price_list_id, status').eq('org_id', orgId)
    : { data: [] }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Price Lists"
        subtitle="Browse supplier price lists"
        count={priceLists?.length}
      />
      <div className="p-8">
        <PriceListsManager
          priceLists={priceLists ?? []}
          canManage={canManage}
          accessRecords={accessRecords ?? []}
        />
      </div>
    </div>
  )
}
