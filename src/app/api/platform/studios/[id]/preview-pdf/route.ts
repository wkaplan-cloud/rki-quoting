import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { QuotePDF } from '@/lib/pdf/QuotePDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import type { Project, Client, LineItem } from '@/lib/types'

export const maxDuration = 60

const MOCK_PROJECT: Project = {
  id: 'preview',
  project_number: 'QT-PREVIEW',
  project_name: 'Hillside Residence',
  client_id: 'preview-client',
  date: new Date().toISOString().split('T')[0],
  status: 'Quote',
  design_fee: 15,
  vat_rate: 15,
  deposit_percentage: 50,
  notes: null,
  created_at: new Date().toISOString(),
  user_id: null,
  sage_invoice_id: null,
  sage_invoice_status: null,
  sage_pushed_at: null,
  sage_customer_id: null,
  sage_customer_name: null,
  deposit_amount_received: null,
  quoted_date: new Date().toISOString().split('T')[0],
  archived_at: null,
  assigned_to: null,
}

const MOCK_CLIENT: Client = {
  id: 'preview-client',
  client_name: 'Sarah & James Nkosi',
  company: null,
  email: 'sarah@example.com',
  vat_number: null,
  contact_number: null,
  address: 'Sandton, Johannesburg',
  created_at: new Date().toISOString(),
}

const NULL_EXTRAS = {
  fabric_image_url: null, unit: null, lead_time_weeks: null, lead_time_days: null,
  dimensions: null, colour_finish: null, twinbru_product_id: null, twinbru_cost_price: null,
  fabric_width_cm: null, parent_item_id: null, created_at: new Date().toISOString(),
}

const MOCK_LINE_ITEMS: LineItem[] = [
  { id: '1', project_id: 'preview', item_name: 'Custom Dining Table', description: 'Solid oak, 2400mm × 900mm', quantity: 1, supplier_id: null, supplier_name: 'Artisan Furniture Co.', delivery_address: null, cost_price: 18500, markup_percentage: 35, sale_price_override: null, sort_order: 0, row_type: 'item', indent_level: 0, received: false, ...NULL_EXTRAS },
  { id: '2', project_id: 'preview', item_name: 'Upholstered Dining Chairs', description: 'Set of 8 — linen blend', quantity: 8, supplier_id: null, supplier_name: 'Fabric & Form', delivery_address: null, cost_price: 3200, markup_percentage: 35, sale_price_override: null, sort_order: 1, row_type: 'item', indent_level: 0, received: false, ...NULL_EXTRAS },
  { id: '3', project_id: 'preview', item_name: 'Pendant Light Cluster', description: 'Brushed brass, 5-drop', quantity: 1, supplier_id: null, supplier_name: 'Luminaire SA', delivery_address: null, cost_price: 7800, markup_percentage: 30, sale_price_override: null, sort_order: 2, row_type: 'item', indent_level: 0, received: false, ...NULL_EXTRAS },
  { id: '4', project_id: 'preview', item_name: 'Feature Rug', description: '3000mm × 2000mm hand-knotted wool', quantity: 1, supplier_id: null, supplier_name: 'The Rug Collective', delivery_address: null, cost_price: 12000, markup_percentage: 25, sale_price_override: null, sort_order: 3, row_type: 'item', indent_level: 0, received: false, ...NULL_EXTRAS },
]

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: orgId } = await params

    // Look up the admin member's user_id for this org
    const { data: adminMember } = await supabaseAdmin
      .from('org_members')
      .select('user_id')
      .eq('org_id', orgId)
      .eq('role', 'admin')
      .eq('status', 'active')
      .maybeSingle()

    if (!adminMember?.user_id) {
      return NextResponse.json({ error: 'No admin member found' }, { status: 404 })
    }

    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('logo_url, business_name, business_address, vat_number, company_registration, bank_name, bank_account_number, bank_branch_code, footer_text, terms_conditions, deposit_percentage, vat_rate, quote_validity_days, payment_terms, lead_time, pdf_template, pdf_color_theme')
      .eq('user_id', adminMember.user_id)
      .maybeSingle()

    // Allow ?template= and ?theme= overrides from the picker
    const templateOverride = req.nextUrl.searchParams.get('template')
    const themeOverride = req.nextUrl.searchParams.get('theme')

    const logoUrl = await fetchLogoBase64(settings?.logo_url ?? null)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(QuotePDF, {
        project: MOCK_PROJECT,
        client: MOCK_CLIENT,
        lineItems: MOCK_LINE_ITEMS,
        type: 'quote',
        templateKey: templateOverride ?? settings?.pdf_template ?? 'minimal',
        themeKey: themeOverride ?? settings?.pdf_color_theme ?? 'warm',
        logoUrl,
        businessName: settings?.business_name ?? 'Your Studio Name',
        businessAddress: settings?.business_address ?? null,
        vatNumber: settings?.vat_number ?? null,
        companyReg: settings?.company_registration ?? null,
        bankName: settings?.bank_name ?? null,
        bankAccount: settings?.bank_account_number ?? null,
        bankBranch: settings?.bank_branch_code ?? null,
        footerText: settings?.footer_text ?? 'Thank you for your business.',
        termsConditions: settings?.terms_conditions ?? null,
        depositPct: settings?.deposit_percentage ?? 50,
        vatRate: settings?.vat_rate ?? 15,
        quotedDate: MOCK_PROJECT.quoted_date,
        validityDays: settings?.quote_validity_days ?? 30,
        paymentTerms: settings?.payment_terms ?? null,
        leadTime: settings?.lead_time ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any)


    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
