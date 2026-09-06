export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { PriceListView } from '@/app/(app)/price-lists/[id]/PriceListView'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function PlatformPriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: priceList } = await supabaseAdmin.from('price_lists').select('*').eq('id', id).single()
  if (!priceList) notFound()

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Link href="/platform/price-lists" className="inline-flex items-center gap-1.5 text-sm text-[#5C5A54] hover:text-[#1A1A18] mb-6 transition-colors">
        <ChevronLeft size={14} /> Price Lists
      </Link>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#1A1A18]">{priceList.name}</h1>
        <p className="text-sm text-[#5C5A54] mt-0.5">{priceList.supplier_name} · {priceList.item_count.toLocaleString()} items</p>
      </div>
      <PriceListView priceListId={id} canEdit isGlobal={!!priceList.is_global} />
    </div>
  )
}
