export const dynamic = 'force-dynamic'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { JobCardDetail } from './JobCardDetail'
import type { ElecJobCard, ElecStaff, ElecClient } from '@/lib/elec-types'

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
    .select(`*, staff:elec_staff(id,name,color,role,phone,email), client:elec_clients(id,client_name,email,contact_number)`)
    .eq('id', id)
    .eq('portal_account_id', accountId!)
    .maybeSingle()

  if (!card) notFound()

  const [{ data: materials }, { data: photos }, { data: staff }, { data: clients }] = await Promise.all([
    supabaseAdmin.from('elec_job_card_materials').select('*').eq('job_card_id', id).order('created_at'),
    supabaseAdmin.from('elec_job_card_photos').select('*').eq('job_card_id', id).order('uploaded_at'),
    supabaseAdmin.from('elec_staff').select('id,name,color,role').eq('portal_account_id', accountId!).eq('is_active', true).order('name'),
    supabaseAdmin.from('elec_clients').select('id,client_name,company,email').eq('portal_account_id', accountId!).order('client_name'),
  ])

  const jobCard: ElecJobCard = { ...card, materials: materials ?? [], photos: photos ?? [] }

  return (
    <JobCardDetail
      jobCard={jobCard}
      staff={(staff ?? []) as ElecStaff[]}
      clients={(clients ?? []) as ElecClient[]}
      portalAccountId={accountId!}
      companyName={own?.company_name ?? ''}
    />
  )
}
