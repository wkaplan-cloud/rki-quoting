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

  const [{ data: pieces }, { data: suppliers }, { data: hotels }] = await Promise.all([
    supabase
      .from('capital_pieces')
      .select('*, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, updated_at), variants:capital_piece_variants(id, label, dimensions, sort_order, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id)), hotels:capital_piece_hotels(id, hotel_id, hotel:capital_hotels(id, name))')
      .order('name'),
    supabase
      .from('suppliers')
      .select('id, supplier_name, markup_percentage')
      .order('supplier_name'),
    supabase
      .from('capital_hotels')
      .select('id, name')
      .eq('active', true)
      .order('name'),
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
          hotels={hotels ?? []}
        />
      </div>
    </div>
  )
}
