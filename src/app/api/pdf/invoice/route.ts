import { NextRequest, NextResponse } from 'next/server'
import { todaySA } from '@/lib/dates'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/QuotePDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { fetchLineItemImages } from '@/lib/pdf/lineItemImages'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [{ data: project }, { data: lineItems }, { data: settings }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single(),
      supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order').order('created_at'),
      supabase.from('settings').select('logo_url, business_name, business_address, vat_number, company_registration, bank_name, bank_account_number, bank_branch_code, footer_text, terms_conditions, deposit_percentage, vat_rate, quote_validity_days, payment_terms, lead_time, pdf_template, pdf_color_theme, show_images_on_documents').maybeSingle(),
    ])

    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [logoUrl, itemImages] = await Promise.all([
      fetchLogoBase64(settings?.logo_url),
      fetchLineItemImages(lineItems ?? [], settings?.show_images_on_documents ?? false),
    ])

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(QuotePDF, { project, client: project.client ?? null, lineItems: lineItems ?? [], type: 'invoice', templateKey: settings?.pdf_template ?? 'minimal', themeKey: settings?.pdf_color_theme ?? 'warm', vatRate: (project as any).vat_rate ?? (settings as any)?.vat_rate ?? 15, logoUrl, businessName: settings?.business_name, businessAddress: settings?.business_address, vatNumber: settings?.vat_number, companyReg: settings?.company_registration, bankName: settings?.bank_name, bankAccount: settings?.bank_account_number, bankBranch: settings?.bank_branch_code, footerText: settings?.footer_text, termsConditions: settings?.terms_conditions, depositPct: project.deposit_percentage ?? settings?.deposit_percentage ?? 50, amountPaid: (project as any).deposit_amount_received ?? 0, quotedDate: project.quoted_date ?? todaySA(), paymentTerms: settings?.payment_terms ?? null, leadTime: settings?.lead_time ?? null, itemImages }) as any
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${project.project_number}.pdf"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
