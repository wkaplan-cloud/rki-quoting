export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PriceListsManager } from '@/app/(app)/price-lists/PriceListsManager'
import { PlatformAccessRequests } from './PlatformAccessRequests'
import { PlatformActiveAccess } from './PlatformActiveAccess'
import { TwinbruSyncPanel } from './TwinbruSyncPanel'

export default async function PlatformPriceListsPage() {
  const [{ data: priceLists }, { data: allAccess }] = await Promise.all([
    supabaseAdmin
      .from('price_lists')
      .select('id, name, supplier_name, item_count, created_at, is_global')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('price_list_access')
      .select('id, org_id, price_list_id, status, requested_at, approved_at')
      .in('status', ['pending', 'active', 'rejected'])
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
  const activeAccess = withOrgName.filter(r => r.status === 'active' || r.status === 'rejected')

  // Query each sync type separately to avoid shared row-limit masking recent runs
  const SYNC_FIELDS = 'id, sync_type, started_at, completed_at, status, items_checked, items_changed, items_added, error_message, triggered_by'
  const [priceLogsRes, loadLogsRes, backfillLogsRes, discontinuedLogsRes, catalogueCountRes] = await Promise.all([
    supabaseAdmin.from('twinbru_sync_log').select(SYNC_FIELDS).eq('sync_type', 'prices').order('started_at', { ascending: false }).limit(5),
    supabaseAdmin.from('twinbru_sync_log').select(SYNC_FIELDS).eq('sync_type', 'load').order('started_at', { ascending: false }).limit(10),
    supabaseAdmin.from('twinbru_sync_log').select(SYNC_FIELDS).eq('sync_type', 'backfill').order('started_at', { ascending: false }).limit(5),
    supabaseAdmin.from('twinbru_sync_log').select(SYNC_FIELDS).eq('sync_type', 'discontinued').order('started_at', { ascending: false }).limit(5),
    supabaseAdmin.from('price_list_items').select('id', { count: 'exact', head: true }).not('product_id', 'is', null),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function pick(rows: any[], ...finders: ((l: any) => boolean)[]): any {
    for (const fn of finders) {
      const found = rows.find(fn)
      if (found) return found
    }
    return null
  }

  const lastPriceSync = pick(
    priceLogsRes.data ?? [],
    l => l.status === 'ok',
    l => !!l.completed_at,
    () => true,
  )
  const lastLoadSync = pick(
    loadLogsRes.data ?? [],
    l => l.status === 'ok' && !l.error_message?.startsWith('RESUME:'),
    l => !!l.completed_at,
    () => true,
  )
  const lastDiscontinuedSync = pick(
    discontinuedLogsRes.data ?? [],
    l => l.status === 'ok',
    () => true,
  )
  const lastImageSync = pick(
    backfillLogsRes.data ?? [],
    l => l.status === 'ok',
    () => true,
  )
  const catalogueCount = catalogueCountRes.count ?? 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A18]">Price Lists</h1>
        <p className="text-sm text-[#5C5A54] mt-0.5">Manage platform-wide price lists available to all studios</p>
      </div>

      {/* Twinbru Sync */}
      <TwinbruSyncPanel
        lastPriceSync={lastPriceSync}
        lastLoadSync={lastLoadSync}
        lastDiscontinuedSync={lastDiscontinuedSync}
        lastImageSync={lastImageSync}
        catalogueCount={catalogueCount}
        cronSecret={process.env.CRON_SECRET ?? ''}
      />

      {/* Pending requests */}
      <div>
        <h2 className="text-sm font-semibold text-[#3F3D38] uppercase tracking-wider mb-3">
          Access Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#7E6036] text-white text-[10px] font-bold">{pendingRequests.length}</span>
          )}
        </h2>
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-[#6E6B63] bg-[#FDFCF9] border border-[#DED8CC] rounded-lg px-5 py-4">No pending access requests.</p>
        ) : (
          <PlatformAccessRequests requests={pendingRequests} priceLists={priceLists ?? []} />
        )}
      </div>

      {/* Active / approved access */}
      <div>
        <h2 className="text-sm font-semibold text-[#3F3D38] uppercase tracking-wider mb-3">
          Approved Access
          {activeAccess.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-emerald-100 text-[#047857] text-[10px] font-bold px-1">{activeAccess.length}</span>
          )}
        </h2>
        {activeAccess.length === 0 ? (
          <p className="text-sm text-[#6E6B63] bg-[#FDFCF9] border border-[#DED8CC] rounded-lg px-5 py-4">No studios have been approved yet.</p>
        ) : (
          <PlatformActiveAccess access={activeAccess} priceLists={priceLists ?? []} />
        )}
      </div>

      {/* All price lists */}
      <div>
        <h2 className="text-sm font-semibold text-[#3F3D38] uppercase tracking-wider mb-3">All Price Lists</h2>
        <PriceListsManager priceLists={priceLists ?? []} canManage={true} basePath="/platform/price-lists" />
      </div>
    </div>
  )
}
