export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { StaffJobCard } from './StaffJobCard'
import type { ElecJobCard } from '@/lib/elec-types'
import { normalizeExtras } from '@/lib/job-card-extras'

export default async function StaffJobCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  const { data: staff } = await supabaseAdmin
    .from('elec_staff')
    .select('id, name, portal_account_id, is_active')
    .eq('auth_user_id', user.id)
    .single()

  if (!staff || !staff.is_active) redirect('/supplier-portal/not-a-supplier')

  const { data: card } = await supabaseAdmin
    .from('elec_job_cards')
    .select(`*, client:elec_clients(id,client_name,email,contact_number)`)
    .eq('id', id)
    .eq('staff_id', staff.id)
    .eq('portal_account_id', staff.portal_account_id)
    .maybeSingle()

  if (!card) notFound()

  const [{ data: materials }, { data: photos }, { data: extras }, { data: settings }, { count: jobsCount }, { count: projectsCount }] = await Promise.all([
    supabaseAdmin.from('elec_job_card_materials').select('*').eq('job_card_id', id).order('created_at'),
    supabaseAdmin.from('elec_job_card_photos').select('*').eq('job_card_id', id).order('uploaded_at'),
    // null (not []) when the extra-work migration hasn't been run yet, which is
    // what hides the step rather than showing one that can't save.
    supabaseAdmin.from('elec_job_card_extras').select('*, quote:elec_quotes(id,quote_number,status)')
      .eq('job_card_id', id).order('created_at')
      .then(res => res.error ? { data: null } : res),
    supabaseAdmin.from('elec_settings').select('job_card_extras_enabled')
      .eq('portal_account_id', staff.portal_account_id).maybeSingle()
      .then(res => res.error ? { data: null } : res),
    supabaseAdmin.from('elec_job_cards').select('*', { count: 'exact', head: true })
      .eq('staff_id', staff.id).eq('portal_account_id', staff.portal_account_id)
      .in('status', ['pending', 'in_progress']),
    supabaseAdmin.from('elec_quotes').select('*', { count: 'exact', head: true })
      .eq('staff_id', staff.id).eq('portal_account_id', staff.portal_account_id)
      .in('status', ['approved', 'in_progress']),
  ])

  // Scope from the quote this card came off, so the tech can see what he was
  // sent to do. Descriptions and quantities only — rates never leave the server.
  let scopeItems: { description: string; unit: string | null; qty: number }[] = []
  if (card.quote_id) {
    const { data: lines } = await supabaseAdmin
      .from('elec_quote_line_items')
      .select('description, unit, quoted_quantity')
      .eq('quote_id', card.quote_id)
      .order('sort_order', { ascending: true })
    scopeItems = (lines ?? [])
      .filter(l => l.description?.trim())
      .map(l => ({ description: l.description, unit: l.unit, qty: l.quoted_quantity }))
  }

  const jobCard: ElecJobCard = {
    ...card,
    materials: materials ?? [],
    photos: photos ?? [],
    extras: normalizeExtras(extras),
  }

  return (
    <StaffJobCard
      jobCard={jobCard}
      staffName={staff.name}
      jobsBadge={jobsCount ?? 0}
      projectsBadge={projectsCount ?? 0}
      scopeItems={scopeItems}
      extrasEnabled={extras !== null && (settings as { job_card_extras_enabled?: boolean } | null)?.job_card_extras_enabled !== false}
    />
  )
}
