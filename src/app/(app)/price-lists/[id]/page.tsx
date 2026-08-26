export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { PriceListView } from './PriceListView'
import { Lock, Clock, Info } from 'lucide-react'

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch price list, user, orgId, and access check all in parallel (access is speculative for non-global lists)
  const [{ data: priceList }, { data: { user } }, { data: orgId }, { data: accessRows }] = await Promise.all([
    supabase.from('price_lists').select('*').eq('id', id).single(),
    supabase.auth.getUser(),
    supabase.rpc('get_current_org_id'),
    supabaseAdmin.from('price_list_access').select('status, org_id').eq('price_list_id', id),
  ])

  if (!priceList) notFound()

  // Org admins can edit their own studio's lists; the platform admin can edit any
  const isPlatformAdmin = !!(user && process.env.PLATFORM_ADMIN_EMAIL && user.email === process.env.PLATFORM_ADMIN_EMAIL)
  let canEdit = isPlatformAdmin
  if (!canEdit && user && priceList.org_id && priceList.org_id === orgId) {
    const { data: membership } = await supabaseAdmin
      .from('org_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    canEdit = membership?.role === 'admin'
  }

  // For global price lists, check the org has active access
  if (priceList.is_global && orgId) {
    const access = (accessRows ?? []).find(r => r.org_id === orgId) ?? null

    if (!access || access.status !== 'active') {
      return (
        <div className="flex flex-col h-full">
          <PageHeader title={priceList.name} subtitle={`${priceList.supplier_name} · ${priceList.item_count.toLocaleString()} items`} />
          <div className="flex flex-col items-center justify-center flex-1 py-24 text-center px-8">
            {!access || access.status === 'rejected' ? (
              <>
                <Lock size={36} className="text-[#D8D3C8] mb-4" />
                <p className="text-sm font-medium text-[#2C2C2A]">Access required</p>
                <p className="text-sm text-[#8A877F] mt-1 max-w-xs">Your studio does not have access to this price list. Go to Price Lists and request access.</p>
              </>
            ) : (
              <>
                <Clock size={36} className="text-[#D8D3C8] mb-4" />
                <p className="text-sm font-medium text-[#2C2C2A]">Access pending</p>
                <p className="text-sm text-[#8A877F] mt-1 max-w-xs">Your request is awaiting approval from the platform admin.</p>
              </>
            )}
          </div>
        </div>
      )
    }
  }

  // Snapshot notice — platform lists that are NOT the live-synced Home Fabrics feed
  // carry imported prices that can drift, so designers must confirm before ordering.
  const isSnapshot = !!priceList.is_global && priceList.supplier_name !== 'Home Fabrics'
  const capturedOn = priceList.created_at
    ? new Date(priceList.created_at).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={priceList.name}
        subtitle={`${priceList.supplier_name} · ${priceList.item_count.toLocaleString()} items`}
      />
      {isSnapshot && (
        <div className="mx-8 mt-4 flex items-start gap-2.5 rounded-lg border border-[#E4D3A8] bg-[#FBF6E9] px-4 py-3">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-[#9A7B4F]" />
          <p className="text-xs leading-relaxed text-[#6B5D42]">
            These are <strong>trade prices captured{capturedOn ? ` in ${capturedOn}` : ''}</strong> — a snapshot, not a live feed.
            Prices may have changed since. Always confirm current pricing with {priceList.supplier_name} before ordering.
          </p>
        </div>
      )}
      <PriceListView priceListId={id} canEdit={canEdit} isGlobal={!!priceList.is_global} />
    </div>
  )
}
