export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PriceListsManager } from '@/app/(app)/price-lists/PriceListsManager'
import { PlatformAccessRequests } from './PlatformAccessRequests'

export default async function PlatformPriceListsPage() {
  const [{ data: priceLists }, { data: accessRequests }] = await Promise.all([
    supabaseAdmin
      .from('price_lists')
      .select('id, name, supplier_name, item_count, created_at, is_global')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('price_list_access')
      .select('id, org_id, price_list_id, status, requested_at, orgs(name)')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true }),
  ])

  const pendingCount = accessRequests?.length ?? 0

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Price Lists</h1>
        <p className="text-sm text-white/50 mt-0.5">Manage platform-wide price lists available to all studios</p>
      </div>

      {pendingCount > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
            Access Requests
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#9A7B4F] text-white text-[10px] font-bold">{pendingCount}</span>
          </h2>
          <PlatformAccessRequests requests={accessRequests ?? []} priceLists={priceLists ?? []} />
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">All Price Lists</h2>
        <PriceListsManager priceLists={priceLists ?? []} canManage={true} basePath="/platform/price-lists" />
      </div>
    </div>
  )
}
