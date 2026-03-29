export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PriceListsManager } from '@/app/(app)/price-lists/PriceListsManager'
import { PlatformAccessRequests } from './PlatformAccessRequests'

export default async function PlatformPriceListsPage() {
  const [{ data: priceLists }, { data: rawRequests }] = await Promise.all([
    supabaseAdmin
      .from('price_lists')
      .select('id, name, supplier_name, item_count, created_at, is_global')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('price_list_access')
      .select('id, org_id, price_list_id, status, requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true }),
  ])

  // Look up org names separately (no FK constraint needed)
  const orgIds = [...new Set((rawRequests ?? []).map(r => r.org_id))]
  const { data: orgs } = orgIds.length
    ? await supabaseAdmin.from('organizations').select('id, name').in('id', orgIds)
    : { data: [] }

  const accessRequests = (rawRequests ?? []).map(r => ({
    ...r,
    orgName: (orgs ?? []).find(o => o.id === r.org_id)?.name ?? r.org_id,
  }))

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Price Lists</h1>
        <p className="text-sm text-white/50 mt-0.5">Manage platform-wide price lists available to all studios</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
          Access Requests
          {accessRequests.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#9A7B4F] text-white text-[10px] font-bold">{accessRequests.length}</span>
          )}
        </h2>
        {accessRequests.length === 0 ? (
          <p className="text-sm text-white/30 bg-[#1A1A18] border border-white/10 rounded-lg px-5 py-4">No pending access requests.</p>
        ) : (
          <PlatformAccessRequests requests={accessRequests} priceLists={priceLists ?? []} />
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">All Price Lists</h2>
        <PriceListsManager priceLists={priceLists ?? []} canManage={true} basePath="/platform/price-lists" />
      </div>
    </div>
  )
}
