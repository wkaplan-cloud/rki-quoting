import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { QuotePDF } from '@/lib/pdf/QuotePDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { projectId, type, overrideEmail, customBody } = await req.json() as { projectId: string; type: 'quote' | 'invoice'; overrideEmail?: string; customBody?: string }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: project }, { data: lineItems }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order'),
    supabase.from('settings').select('logo_url, business_name, business_address, vat_number, company_registration, bank_name, bank_account_number, bank_branch_code, footer_text, terms_conditions, email_from').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Use override email from modal, or fall back to what's saved on the client
  const clientEmail = overrideEmail?.trim() || (project.client as any)?.email
  if (!clientEmail) return NextResponse.json({ error: 'Client email not set' }, { status: 400 })

  try {
    const logoUrl = await fetchLogoBase64(settings?.logo_url)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(QuotePDF, {
        project,
        client: project.client ?? null,
        lineItems: lineItems ?? [],
        type,
        logoUrl,
        businessName: settings?.business_name,
        businessAddress: settings?.business_address,
        vatNumber: settings?.vat_number,
        companyReg: settings?.company_registration,
        bankName: settings?.bank_name,
        bankAccount: settings?.bank_account_number,
        bankBranch: settings?.bank_branch_code,
        footerText: settings?.footer_text,
        termsConditions: settings?.terms_conditions,
      }) as any
    )

    const label = type === 'quote' ? 'Quotation' : 'Invoice'
    const subject = `${label} - ${project.project_name} - ${project.project_number}`
    const studioName = settings?.business_name ?? 'Your Studio'
    const studioReplyTo = settings?.email_from

    const { error: resendError } = await resend.emails.send({
      from: `${studioName} <quotes@quotinghub.co.za>`,
      ...(studioReplyTo ? { replyTo: studioReplyTo } : {}),
      to: clientEmail,
      subject,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background-color:#1A1A18;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:normal;color:#F5F2EC;letter-spacing:0.02em;">${studioName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#9A7B4F;letter-spacing:0.08em;text-transform:uppercase;">${label}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            ${customBody
              ? customBody.split('\n').map(line =>
                  line.trim() === ''
                    ? '<div style="height:12px;"></div>'
                    : `<p style="margin:0 0 4px;font-size:15px;line-height:1.7;color:#2C2C2A;">${line}</p>`
                ).join('')
              : `<p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2C2C2A;">Dear ${project.client?.client_name ?? 'Client'},</p>
                 <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2C2C2A;">Please find attached your ${label.toLowerCase()} for <strong>${project.project_name}</strong>.</p>`
            }

            <!-- Reference box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:14px 18px;">
                  <p style="margin:0;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Reference</p>
                  <p style="margin:4px 0 0;font-size:16px;color:#1A1A18;font-family:Georgia,serif;letter-spacing:0.02em;">${project.project_number}</p>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;font-size:13px;color:#8A877F;line-height:1.6;">The PDF is attached to this email. Please don't hesitate to reach out if you have any questions.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${studioName}${studioReplyTo ? ` &middot; <a href="mailto:${studioReplyTo}" style="color:#8A877F;text-decoration:none;">${studioReplyTo}</a>` : ''}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Sent via <a href="https://quotinghub.co.za" style="color:#C4BFB5;text-decoration:none;">QuotingHub</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      attachments: [{
        filename: `${project.project_number}-${type}.pdf`,
        content: Buffer.from(buffer),
      }],
    })

    if (resendError) {
      return NextResponse.json({ error: resendError.message }, { status: 500 })
    }

    // Log the send
    await supabase.from('email_logs').insert({
      project_id: projectId,
      type,
      sent_to: clientEmail,
      sent_by: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
