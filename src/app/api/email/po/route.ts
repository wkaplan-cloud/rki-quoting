import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { POPDF } from '@/lib/pdf/POPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { projectId, supplierId } = await req.json() as { projectId: string; supplierId?: string }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: project }, { data: allLineItems }, { data: allSuppliers }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('suppliers').select('*'),
    supabase.from('settings').select('vat_rate, logo_url, business_name, business_address, vat_number, company_registration, accounts_email, email_from').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const vatRate = project.vat_rate ?? settings?.vat_rate ?? 15
  const logoUrl = await fetchLogoBase64(settings?.logo_url)
  const studioName = settings?.business_name ?? 'Your Studio'
  const accountsEmail = settings?.accounts_email?.trim() || null
  const replyTo = settings?.email_from?.trim() || null

  // Which suppliers to send to
  const supplierIds = supplierId
    ? [supplierId]
    : [...new Set(
        (allLineItems ?? []).filter(i => i.row_type !== 'section' && i.supplier_id).map(i => i.supplier_id!)
      )]

  if (supplierIds.length === 0) {
    return NextResponse.json({ error: 'No suppliers with line items found' }, { status: 400 })
  }

  const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

  const results: { supplierId: string; supplierName: string; success: boolean; error?: string }[] = []

  for (const sid of supplierIds) {
    const supplier = (allSuppliers ?? []).find(s => s.id === sid)
    if (!supplier?.email) {
      results.push({ supplierId: sid, supplierName: supplier?.supplier_name ?? sid, success: false, error: 'No email address on supplier' })
      continue
    }

    // Filter line items for this supplier (include section rows that have items beneath them)
    const all = allLineItems ?? []
    const items: typeof all = []
    let pendingSection: typeof all[number] | null = null
    for (const item of all) {
      if (item.row_type === 'section') { pendingSection = item }
      else if (item.supplier_id === sid) {
        if (pendingSection) { items.push(pendingSection); pendingSection = null }
        items.push(item)
      }
    }

    const poNumber = `${project.project_number}-${supplier.supplier_name.slice(0, 3).toUpperCase()}`
    const filename = `${slug(project.project_number)}_PO_${slug(supplier.supplier_name)}.pdf`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      createElement(POPDF, {
        project,
        lineItems: items,
        suppliers: allSuppliers ?? [],
        supplierId: sid,
        vatRate,
        logoUrl,
        businessName: settings?.business_name,
        businessAddress: settings?.business_address,
        vatNumber: settings?.vat_number,
        companyReg: settings?.company_registration,
      }) as any
    )

    const subject = `Purchase Order ${poNumber} – ${project.project_name}`

    const { error: resendError } = await resend.emails.send({
      from: `${studioName} <quotes@quotinghub.co.za>`,
      ...(replyTo ? { replyTo } : {}),
      to: supplier.email,
      ...(supplier.email_cc ? { cc: supplier.email_cc } : {}),
      ...(accountsEmail ? { bcc: accountsEmail } : {}),
      subject,
      text: `Dear ${supplier.contact_person || supplier.supplier_name},\n\nPlease find attached Purchase Order ${poNumber} for ${project.project_name}.\n\nKindly acknowledge receipt and confirm availability.\n\nKind regards,\n${studioName}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#4A4A47;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">${studioName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Purchase Order</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Dear ${supplier.contact_person || supplier.supplier_name},</p>
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Please find attached Purchase Order for <strong>${project.project_name}</strong>. Kindly acknowledge receipt and confirm availability.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:14px 18px;">
                  <p style="margin:0;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">PO Reference</p>
                  <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:#1A1A18;">${poNumber}</p>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;color:#8A877F;line-height:1.6;">The PDF is attached. Please reference the PO number on all correspondence and delivery notes.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${studioName}${replyTo ? ` &middot; <a href="mailto:${replyTo}" style="color:#8A877F;text-decoration:none;">${replyTo}</a>` : ''}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      attachments: [{ filename, content: Buffer.from(buffer) }],
    })

    if (resendError) {
      results.push({ supplierId: sid, supplierName: supplier.supplier_name, success: false, error: resendError.message })
    } else {
      results.push({ supplierId: sid, supplierName: supplier.supplier_name, success: true })
    }
  }

  const allOk = results.every(r => r.success)
  const anyOk = results.some(r => r.success)

  if (!anyOk) {
    return NextResponse.json({ error: results.map(r => `${r.supplierName}: ${r.error}`).join('; ') }, { status: 500 })
  }

  return NextResponse.json({ success: true, results }, { status: allOk ? 200 : 207 })
}
