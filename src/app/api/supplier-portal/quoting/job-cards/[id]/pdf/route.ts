import { NextRequest, NextResponse } from 'next/server'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { JobCardPDF } from '@/lib/pdf/JobCardPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { ElecJobCard, ElecSettings } from '@/lib/elec-types'

export const maxDuration = 60

async function resolveAccount(userId: string) {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name, email, logo_url')
    .eq('auth_user_id', userId).maybeSingle()
  if (own) return own
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (!mem) return null
  const { data: acc } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id, company_name, email, logo_url')
    .eq('id', mem.portal_account_id).maybeSingle()
  return acc
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const account = await resolveAccount(user.id)
    if (!account) return NextResponse.json({ error: 'No account' }, { status: 403 })

    const [{ data: jobCard }, { data: materials }, { data: photos }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('elec_job_cards')
        .select('*, staff:elec_staff(id,name,color,role,phone,email), client:elec_clients(id,client_name,email)')
        .eq('id', id)
        .eq('portal_account_id', account.id)
        .single(),
      supabaseAdmin
        .from('elec_job_card_materials').select('*').eq('job_card_id', id).order('created_at'),
      supabaseAdmin
        .from('elec_job_card_photos').select('*').eq('job_card_id', id).order('uploaded_at'),
      supabaseAdmin
        .from('elec_settings').select('*').eq('portal_account_id', account.id).maybeSingle(),
    ])

    if (!jobCard) return NextResponse.json({ error: 'Job card not found' }, { status: 404 })

    const companyName = account.company_name ?? account.email ?? 'Company'
    const logoBase64 = await fetchLogoBase64(account.logo_url)

    const fullJobCard: ElecJobCard = { ...jobCard as ElecJobCard, materials: materials ?? [], photos: photos ?? [] }

    const buffer = await renderPdfToBuffer(
      createElement(JobCardPDF, {
        jobCard: fullJobCard,
        companyName,
        settings: (settings ?? null) as ElecSettings | null,
        logoBase64,
        asInvoice: false,
      })
    )

    const filename = `${jobCard.job_number}-JobCard.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
