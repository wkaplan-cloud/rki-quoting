export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { StaffInspection } from './StaffInspection'
import type { ElecJobCard, ElecCOC } from '@/lib/elec-types'

export default async function StaffInspectionPage({ params }: { params: Promise<{ id: string }> }) {
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

  const [{ data: materials }, { data: coc }, { count: jobsCount }, { count: projectsCount }] = await Promise.all([
    supabaseAdmin.from('elec_job_card_materials').select('*').eq('job_card_id', id).order('created_at'),
    supabaseAdmin.from('elec_coc').select('*').eq('job_card_id', id).maybeSingle(),
    supabaseAdmin.from('elec_job_cards').select('*', { count: 'exact', head: true })
      .eq('staff_id', staff.id).eq('portal_account_id', staff.portal_account_id)
      .in('status', ['pending', 'in_progress']),
    supabaseAdmin.from('elec_quotes').select('*', { count: 'exact', head: true })
      .eq('staff_id', staff.id).eq('portal_account_id', staff.portal_account_id)
      .in('status', ['approved', 'in_progress']),
  ])

  const jobCard: ElecJobCard = { ...card, materials: materials ?? [], photos: [] }

  return (
    <StaffInspection
      jobCard={jobCard}
      initialCOC={coc as ElecCOC | null}
      jobsBadge={jobsCount ?? 0}
      projectsBadge={projectsCount ?? 0}
    />
  )
}
