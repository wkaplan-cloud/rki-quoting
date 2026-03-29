export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PriceListsManager } from '@/app/(app)/price-lists/PriceListsManager'
import { PlatformAccessRequests } from './PlatformAccessRequests'
import { PlatformActiveAccess } from './PlatformActiveAccess'

export default async function PlatformPriceListsPage() {
  const [{ data: priceLists }, { data: allAccess }] = await Promise.all([
    supabaseAdmin
      .from('price_lists')
      .select('id, name, supplier_name, item_count, created_at, is_global')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('price_list_access')
      .select('id, org_id, price_list_id, status, requested_at, approved_at')
      .in('status', ['pending', 'active'])
      .order('requested_at', { ascending: true }),
  ])

  // Look up org names separately
  const orgIds = [...new Set((allAccess ?? []).map(r => r.org_id))]
  const { data: orgs } = orgIds.length
    ? await supabaseAdmin.from('organizations').select('id, name').in('id', orgIds)
    : { data: [] }

  const withOrgName = (allAccess ?? []).map(r => ({
    ...r,
    orgName: (orgs ?? []).find(o => o.id === r.org_id)?.name ?? r.org_id,
  }))

  const pendingRequests = withOrgName.filter(r => r.status === 'pending')
  const activeAccess = withOrgName.filter(r => r.status === 'active')

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-white">Price Lists</h1>
        <p className="text-sm text-white/50 mt-0.5">Manage platform-wide price lists available to all studios</p>
      </div>

      {/* Pending requests */}
      <div>
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
          Access Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#9A7B4F] text-white text-[10px] font-bold">{pendingRequests.length}</span>
          )}
        </h2>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-white/30 bg-[#1A1A18] border border-white/10 rounded-lg px-5 py-4">No pending access requests.</p>
        ) : (
          <PlatformAccessRequests requests={pendingRequests} priceLists={priceLists ?? []} />
        )}
      </div>

      {/* Active / approved access */}
      <div>
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
          Approved Access
          {activeAccess.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-emerald-900/60 text-emerald-400 text-[10px] font-bold px-1">{activeAccess.length}</span>
          )}
        </h2>
        {activeAccess.length === 0 ? (
          <p className="text-sm text-white/30 bg-[#1A1A18] border border-white/10 rounded-lg px-5 py-4">No studios have been approved yet.</p>
        ) : (
          <PlatformActiveAccess access={activeAccess} priceLists={priceLists ?? []} />
        )}
      </div>

      {/* All price lists */}
      <div>
        <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">All Price Lists</h2>
        <PriceListsManager priceLists={priceLists ?? []} canManage={true} basePath="/platform/price-lists" />
      </div>
    </div>
  )
}
