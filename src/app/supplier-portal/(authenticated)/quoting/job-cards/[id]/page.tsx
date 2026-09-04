export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { JobCardDetail, type JobCardBooking } from './JobCardDetail'
import type { ElecJobCard, ElecStaff, ElecClient, ElecCOC } from '@/lib/elec-types'
import { normalizeExtras } from '@/lib/job-card-extras'
import { one, type Embedded } from '@/lib/supabase/embed'

export default async function JobCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/supplier-portal/login')

  let accountId: string | null = null

  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name')
    .eq('auth_user_id', user.id).maybeSingle()
  if (own) { accountId = own.id } else {
    const { data: mem } = await supabaseAdmin
      .from('portal_org_members').select('portal_account_id')
      .eq('auth_user_id', user.id).not('accepted_at', 'is', null).maybeSingle()
    if (mem) accountId = mem.portal_account_id
    else redirect('/supplier-portal/not-a-supplier')
  }

  const { data: card } = await supabaseAdmin
    .from('elec_job_cards')
    .select(`*, staff:elec_staff(id,name,color,role,phone,email), client:elec_clients(id,client_name,email,contact_number,vat_number)`)
    .eq('id', id)
    .eq('portal_account_id', accountId!)
    .maybeSingle()

  if (!card) notFound()

  const [{ data: materials }, { data: photos }, { data: staff }, { data: clients }, { data: settings }, { data: existingCOC }, { data: bookings }, { data: extras }, { data: extrasSettings }] = await Promise.all([
    supabaseAdmin.from('elec_job_card_materials').select('*').eq('job_card_id', id).order('created_at'),
    supabaseAdmin.from('elec_job_card_photos').select('*').eq('job_card_id', id).order('uploaded_at'),
    supabaseAdmin.from('elec_staff').select('id,name,color,role').eq('portal_account_id', accountId!).eq('is_active', true).order('name'),
    supabaseAdmin.from('elec_clients').select('id,client_name,company,email,address,vat_number,qs_name,qs_email').eq('portal_account_id', accountId!).order('client_name'),
    supabaseAdmin.from('elec_settings').select('sage_company_id, vat_rate, coc_prefix, company_code').eq('portal_account_id', accountId!).maybeSingle(),
    supabaseAdmin.from('elec_coc').select('*').eq('job_card_id', id).maybeSingle(),
    // Slots on the schedule for this card. When one exists the schedule owns
    // the timing, so the date field here defers to it rather than offering a
    // second, silently-overwritten place to set it.
    supabaseAdmin
      .from('elec_jobs')
      .select('id, scheduled_date, start_time, end_time, staff:elec_staff(id,name)')
      .eq('job_card_id', id)
      .eq('portal_account_id', accountId!)
      .order('scheduled_date')
      .then(res => res.error ? { data: [] } : res),
    supabaseAdmin
      .from('elec_job_card_extras')
      .select('*, created_job_card:elec_job_cards!elec_job_card_extras_created_job_card_id_fkey(id,job_number,status)')
      .eq('job_card_id', id)
      .order('created_at')
      // null (not []) when the extra-work migration hasn't been run yet.
      .then(res => res.error ? { data: null } : res),
    // Separate from the settings row above so a missing column can't take the
    // other job-card settings down with it.
    supabaseAdmin
      .from('elec_settings')
      .select('job_card_extras_enabled')
      .eq('portal_account_id', accountId!)
      .maybeSingle()
      .then(res => res.error ? { data: null } : res),
  ])

  // An extra-work card is created unassigned — the office decides who goes back.
  // Surface the tech who found the work as a suggestion rather than picking for them.
  let suggestedStaff: { id: string; name: string; fromJobNumber: string } | null = null
  const extrasFrom = (card as { extras_from_job_card_id?: string | null }).extras_from_job_card_id
  if (extrasFrom && !card.staff_id) {
    const { data: origin } = await supabaseAdmin
      .from('elec_job_cards')
      .select('job_number, staff:elec_staff(id,name)')
      .eq('id', extrasFrom)
      .eq('portal_account_id', accountId!)
      .maybeSingle()
    const originStaff = one((origin as { staff?: Embedded<{ id: string; name: string }> } | null)?.staff)
    if (origin && originStaff) {
      suggestedStaff = { id: originStaff.id, name: originStaff.name, fromJobNumber: origin.job_number }
    }
  }

  const jobCard: ElecJobCard = {
    ...card,
    materials: materials ?? [],
    photos: photos ?? [],
    extras: normalizeExtras(extras),
  }

  return (
    <JobCardDetail
      jobCard={jobCard}
      staff={(staff ?? []) as ElecStaff[]}
      clients={(clients ?? []) as ElecClient[]}
      portalAccountId={accountId!}
      companyName={own?.company_name ?? ''}
      vatRate={(settings as { vat_rate?: number } | null)?.vat_rate ?? 15}
      sageConnected={!!(settings?.sage_company_id)}
      cocPrefix={(settings as { coc_prefix?: string } | null)?.coc_prefix ?? 'COC'}
      companyCode={(settings as { company_code?: string } | null)?.company_code ?? ''}
      initialCOC={(existingCOC ?? null) as ElecCOC | null}
      bookings={(bookings ?? []) as unknown as JobCardBooking[]}
      suggestedStaff={suggestedStaff}
      extrasEnabled={extras !== null && (extrasSettings as { job_card_extras_enabled?: boolean } | null)?.job_card_extras_enabled !== false}
    />
  )
}
