export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { PriceListsManager } from './PriceListsManager'

export default async function PriceListsPage() {
  const supabase = await createClient()
  const { data: priceLists } = await supabase
    .from('price_lists')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Price Lists"
        subtitle="Import and manage supplier price lists"
        count={priceLists?.length}
      />
      <div className="p-8">
        <PriceListsManager priceLists={priceLists ?? []} />
      </div>
    </div>
  )
}
