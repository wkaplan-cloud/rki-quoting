export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { ItemsManager } from './ItemsManager'

export default async function ItemsPage() {
  const supabase = await createClient()
  const { data: items } = await supabase.from('items').select('*').order('item_name')
  return (
    <div>
      <PageHeader title="Items" subtitle="Item name library for line items" />
      <div className="p-8 max-w-xl">
        <ItemsManager items={items ?? []} />
      </div>
    </div>
  )
}
