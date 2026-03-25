export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { PriceListView } from './PriceListView'

export default async function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: priceList } = await supabase.from('price_lists').select('*').eq('id', id).single()
  if (!priceList) notFound()

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
