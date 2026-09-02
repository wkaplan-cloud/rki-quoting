import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ProductionPDF } from '@/lib/pdf/ProductionPDF'
import { apiError } from '@/lib/api-error'
import type { Supplier } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { projectId, toEmail } = await req.json() as { projectId: string; toEmail: string }

    if (!toEmail?.trim()) return NextResponse.json({ error: 'No recipient email provided' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: project }, { data: lineItems }, { data: settings }, { data: suppliers }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single(),
      supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order').order('created_at'),
      supabase.from('settings').select('business_name, email_from, vat_rate').maybeSingle(),
      supabase.from('suppliers').select('id, supplier_name').order('supplier_name'),
    ])

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const vatRate = project.vat_rate ?? settings?.vat_rate ?? 15
    const businessName = settings?.business_name ?? undefined
    const replyToEmail = settings?.email_from?.trim() || user.email || ''
    const printDate = new Date().toISOString()

    const buffer = await renderPdfToBuffer(
      createElement(ProductionPDF, {
        project,
        lineItems: lineItems ?? [],
        suppliers: (suppliers ?? []) as Supplier[],
        businessName,
        vatRate,
        printDate,
      })
    )

    const subject = `Job Cost Sheet – ${project.project_name} (${project.project_number})`
    const studioName = businessName ?? 'Your Studio'

    const { error: resendError } = await sendEmail({
      from: `${studioName} <noreply@quotinghub.co.za>`,
      ...(replyToEmail ? { replyTo: replyToEmail } : {}),
      to: toEmail.trim(),
      subject,
      text: `Job cost sheet for ${project.project_name} (${project.project_number}) is attached.\n\nSent via QuotingHub`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#4A4A47;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:600;color:#F5F2EC;">${studioName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Job Cost Sheet</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2C2C2A;">Please find attached the production sheet for <strong>${project.project_name}</strong>.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:14px 18px;">
                  <p style="margin:0;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Reference</p>
                  <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#1A1A18;">${project.project_number}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${studioName}${replyToEmail ? ` · ${replyToEmail}` : ''}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      attachments: [{
        filename: `JobCostSheet-${project.project_number}.pdf`,
        content: Buffer.from(buffer),
      }],
    })

    if (resendError) return NextResponse.json({ error: resendError.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
