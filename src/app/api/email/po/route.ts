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

  const [{ data: project }, { data: allLineItems }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('settings').select('vat_rate, logo_url, business_name, business_address, vat_number, company_registration, accounts_email, email_from').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const vatRate = project.vat_rate ?? settings?.vat_rate ?? 15
  const studioName = settings?.business_name ?? 'Your Studio'
  const accountsEmail = settings?.accounts_email?.trim() || null
  const replyTo = user.email ?? null

  // Which suppliers to send to
  const supplierIds = supplierId
    ? [supplierId]
    : [...new Set(
        (allLineItems ?? []).filter(i => i.row_type !== 'section' && i.supplier_id).map(i => i.supplier_id!)
      )]

  if (supplierIds.length === 0) {
    return NextResponse.json({ error: 'No suppliers with line items found' }, { status: 400 })
  }

  // Fetch only the suppliers referenced in this project's line items, and logo in parallel
  const [{ data: allSuppliers }, { data: platformContacts }, logoUrl] = await Promise.all([
    supabase.from('suppliers').select('*').in('id', supplierIds),
    supabase.from('platform_supplier_contacts').select('*'),
    fetchLogoBase64(settings?.logo_url),
  ])

  const slug = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')

  const settled = await Promise.allSettled(supplierIds.map(async (sid) => {
    const supplier = (allSuppliers ?? []).find(s => s.id === sid)
    const orgContact = supplier?.is_platform
      ? (platformContacts ?? []).find(c => c.supplier_id === sid)
      : null
    const effectiveEmail = orgContact?.email || supplier?.email
    const effectiveEmailCc = orgContact?.email_cc || supplier?.email_cc
    const effectiveContactPerson = orgContact?.rep_name || supplier?.contact_person || supplier?.supplier_name

    if (!effectiveEmail) {
      const err = supplier?.is_platform ? 'No rep email set — go to Suppliers → Home Fabrics to add your studio\'s rep email' : 'No email address on supplier'
      return { supplierId: sid, supplierName: supplier?.supplier_name ?? sid, success: false, error: err }
    }

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
        printDate: new Date().toISOString(),
      }) as any
    )

    const subject = `Purchase Order ${poNumber} – ${project.project_name}`

    const { error: resendError } = await resend.emails.send({
      from: `${studioName} <no-reply@quotinghub.co.za>`,
      ...(replyTo ? { replyTo } : {}),
      to: effectiveEmail,
      ...(effectiveEmailCc ? { cc: effectiveEmailCc } : {}),
      ...(accountsEmail ? { bcc: accountsEmail } : {}),
      subject,
      text: `Dear ${effectiveContactPerson},\n\nPlease find attached Purchase Order ${poNumber} for ${project.project_name}.\n\nKindly acknowledge receipt and confirm availability.\n\nKind regards,\n${studioName}`,
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
            <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Dear ${effectiveContactPerson},</p>
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
            <p style="margin:2px 0 0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub · Reply directly to this email to reach the studio</p>
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
      return { supplierId: sid, supplierName: supplier.supplier_name, success: false, error: resendError.message }
    }

    // Log the send
    await supabase.from('email_logs').insert({
      project_id: projectId,
      type: 'po',
      sent_to: effectiveEmail,
      supplier_name: supplier.supplier_name,
    })

    return { supplierId: sid, supplierName: supplier.supplier_name, success: true }
  }))

  const results = settled.map(s =>
    s.status === 'fulfilled' ? s.value : { supplierId: '', supplierName: 'Unknown', success: false, error: (s.reason as Error)?.message ?? 'Unknown error' }
  )

  const allOk = results.every(r => r.success)
  const anyOk = results.some(r => r.success)

  if (!anyOk) {
    return NextResponse.json({ error: results.map(r => `${r.supplierName}: ${r.error}`).join('; ') }, { status: 500 })
  }

  return NextResponse.json({ success: true, results }, { status: allOk ? 200 : 207 })
}
