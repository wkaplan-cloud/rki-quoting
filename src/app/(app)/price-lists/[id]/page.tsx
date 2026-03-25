export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { PriceListView } from './PriceListView'

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: priceList }, { data: items }] = await Promise.all([
    supabase.from('price_lists').select('*').eq('id', id).single(),
    supabase.from('price_list_items').select('*').eq('price_list_id', id).order('brand').order('collection').order('design').limit(50000),
  ])

  if (!priceList) notFound()

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={priceList.name}
        subtitle={`${priceList.supplier_name} · ${priceList.item_count.toLocaleString()} items`}
        count={items?.length}
      />
      <PriceListView items={items ?? []} />
    </div>
  )
}
