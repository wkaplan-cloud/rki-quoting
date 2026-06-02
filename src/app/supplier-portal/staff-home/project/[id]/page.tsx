export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { StaffProject } from './StaffProject'

export default async function StaffProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: staff } = await supabaseAdmin
    .from('elec_staff')
    .select('id, name, color, portal_account_id, is_active')
    .eq('auth_user_id', user.id)
    .single()
  if (!staff || !staff.is_active) redirect('/supplier-portal/login')

  const [{ data: quote }, { data: sections }, { data: items }, { data: photos }] = await Promise.all([
    supabaseAdmin
      .from('elec_quotes')
      .select('id, quote_number, project_name, project_address, status, client_id, client:elec_clients(id, client_name, address)')
      .eq('id', id)
      .eq('portal_account_id', staff.portal_account_id)
      .eq('staff_id', staff.id)
      .single(),
    supabaseAdmin
      .from('elec_quote_sections')
      .select('id, title, sort_order')
      .eq('quote_id', id)
      .order('sort_order'),
    supabaseAdmin
      .from('elec_quote_line_items')
      .select('id, section_id, description, unit, quoted_quantity, sort_order, is_variation')
      .eq('quote_id', id)
      .eq('is_variation', false)
      .order('sort_order'),
    supabaseAdmin
      .from('elec_quote_photos')
      .select('id, url, caption, created_at')
      .eq('quote_id', id)
      .order('created_at'),
  ])

  if (!quote) notFound()

  return (
    <StaffProject
      staffId={staff.id}
      staffName={staff.name}
      portalAccountId={staff.portal_account_id}
      quote={quote as typeof quote & { client: { id: string; client_name: string; address: string | null } | null }}
      sections={(sections ?? []) as { id: string; title: string; sort_order: number }[]}
      items={(items ?? []) as { id: string; section_id: string | null; description: string; unit: string | null; quoted_quantity: number; sort_order: number }[]}
      photos={(photos ?? []) as { id: string; url: string; caption: string | null; created_at: string }[]}
    />
  )
}
