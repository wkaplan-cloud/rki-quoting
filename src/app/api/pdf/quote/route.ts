import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/QuotePDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: project }, { data: lineItems }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('settings').select('logo_url, business_name, business_address, vat_number, company_registration, bank_name, bank_account_number, bank_branch_code, footer_text, terms_conditions, deposit_percentage, quote_validity_days, payment_terms, lead_time').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Lock quoted_date on first PDF generation — never overwrite if already set
  let quotedDate = project.quoted_date as string | null
  if (!quotedDate) {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('projects').update({ quoted_date: today }).eq('id', projectId)
    quotedDate = today
  }

  const logoUrl = await fetchLogoBase64(settings?.logo_url)

  const buffer = await renderToBuffer(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(QuotePDF, { project, client: project.client ?? null, lineItems: lineItems ?? [], type: 'quote', logoUrl, businessName: settings?.business_name, businessAddress: settings?.business_address, vatNumber: settings?.vat_number, companyReg: settings?.company_registration, bankName: settings?.bank_name, bankAccount: settings?.bank_account_number, bankBranch: settings?.bank_branch_code, footerText: settings?.footer_text, termsConditions: settings?.terms_conditions, depositPct: project.deposit_percentage ?? settings?.deposit_percentage ?? 70, quotedDate, validityDays: settings?.quote_validity_days ?? 30, paymentTerms: settings?.payment_terms ?? null, leadTime: settings?.lead_time ?? null }) as any
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${project.project_number}_Quote.pdf"`,
    },
  })
}
