export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { CapitalPiecesClient } from './CapitalPiecesClient'

export default async function CapitalPiecesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('settings')
    .select('capital_hotels_enabled')
    .maybeSingle()

  if (!settings?.capital_hotels_enabled) redirect('/dashboard')

  const [{ data: pieces }, { data: suppliers }] = await Promise.all([
    supabase
      .from('capital_pieces')
      .select('*, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, updated_at)')
      .order('name'),
    supabase
      .from('suppliers')
      .select('id, supplier_name, markup_percentage')
      .order('supplier_name'),
  ])

  return (
    <div>
      <PageHeader
        title="Capital Pieces"
        subtitle="Catalog of standard pieces for The Capital Hotels"
      />
      <div className="p-6 lg:p-8">
        <CapitalPiecesClient
          initialPieces={pieces ?? []}
          suppliers={suppliers ?? []}
        />
      </div>
    </div>
  )
}
