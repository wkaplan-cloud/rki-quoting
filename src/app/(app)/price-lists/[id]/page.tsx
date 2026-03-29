export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { PriceListView } from './PriceListView'
import { Lock, Clock } from 'lucide-react'

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: priceList }, { data: { user } }, { data: orgId }] = await Promise.all([
    supabase.from('price_lists').select('*').eq('id', id).single(),
    supabase.auth.getUser(),
    supabase.rpc('get_current_org_id'),
  ])

  if (!priceList) notFound()

  const platformAdmin = process.env.PLATFORM_ADMIN_EMAIL
  const isAdmin = user?.email === platformAdmin

  // For global price lists, check the org has active access (admins bypass)
  if (priceList.is_global && !isAdmin && orgId) {
    const { data: access } = await supabaseAdmin
      .from('price_list_access')
      .select('status')
      .eq('org_id', orgId)
      .eq('price_list_id', id)
      .maybeSingle()

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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={priceList.name}
        subtitle={`${priceList.supplier_name} · ${priceList.item_count.toLocaleString()} items`}
      />
      <PriceListView priceListId={id} />
    </div>
  )
}
