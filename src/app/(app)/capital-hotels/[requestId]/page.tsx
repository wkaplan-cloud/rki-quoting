export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { RequestDetail } from './RequestDetail'

export default async function RequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) redirect('/dashboard')

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('capital_hotels_enabled')
    .eq('org_id', orgId)
    .maybeSingle()
  if (!settings?.capital_hotels_enabled) redirect('/dashboard')

  const [{ data: request }, { data: items }, { data: pieces }, { data: suppliers }] = await Promise.all([
    supabase
      .from('capital_requests')
      .select('id, hotel_name, status, submitted_at, quote_project_id')
      .eq('id', requestId)
      .single(),
    supabase
      .from('capital_request_items')
      .select('*')
      .eq('request_id', requestId)
      .order('sort_order'),
    supabase
      .from('capital_pieces')
      .select('*, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id), variants:capital_piece_variants(id, label, dimensions, sort_order, prices:capital_piece_prices(id, supplier_id, supplier_name, cost_price, notes, variant_id))')
      .order('name'),
    supabase
      .from('suppliers')
      .select('id, supplier_name, markup_percentage')
      .order('supplier_name'),
  ])

  if (!request) notFound()

  return (
    <RequestDetail
      request={request}
      initialItems={items ?? []}
      pieces={pieces ?? []}
      suppliers={suppliers ?? []}
    />
  )
}
