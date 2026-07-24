import { NextRequest, NextResponse } from 'next/server'
import { todaySA } from '@/lib/dates'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { QuotePDF } from '@/lib/pdf/QuotePDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function POST(req: NextRequest) {
  try {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { projectId, type, overrideEmail, customBody } = await req.json() as { projectId: string; type: 'quote' | 'invoice'; overrideEmail?: string; customBody?: string }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [{ data: project }, { data: lineItems }, { data: settings }] = await Promise.all([
    supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single(),
    supabase.from('line_items').select('*').eq('project_id', projectId).order('sort_order').order('created_at'),
    supabase.from('settings').select('logo_url, business_name, business_address, vat_number, vat_rate, company_registration, bank_name, bank_account_number, bank_branch_code, footer_text, terms_conditions, deposit_percentage, email_from, quote_validity_days, payment_terms, lead_time, pdf_template, pdf_color_theme').maybeSingle(),
  ])

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Lock quoted_date on first email send — never overwrite if already set
  let quotedDate = (project as any).quoted_date as string | null
  if (!quotedDate && type === 'quote') {
    const today = todaySA()
    await supabase.from('projects').update({ quoted_date: today }).eq('id', projectId)
    quotedDate = today
  }

  // Use override email from modal, or fall back to what's saved on the client
  const clientEmail = overrideEmail?.trim() || (project.client as any)?.email
  if (!clientEmail) return NextResponse.json({ error: 'Client email not set' }, { status: 400 })

  // Generate (or refresh) an approval token for quote emails
  let approvalToken: string | null = null
  if (type === 'quote') {
    approvalToken = crypto.randomUUID()
    await supabaseAdmin
      .from('quote_approvals')
      .upsert(
        { project_id: projectId, token: approvalToken, decision: null, comment: null, submitted_at: null },
        { onConflict: 'project_id' }
      )
  }

  try {
    const logoUrl = await fetchLogoBase64(settings?.logo_url)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(QuotePDF, {
        project,
        client: project.client ?? null,
        lineItems: lineItems ?? [],
        type,
        templateKey: (settings as any)?.pdf_template ?? 'minimal',
        themeKey: (settings as any)?.pdf_color_theme ?? 'warm',
        vatRate: (project as any).vat_rate ?? settings?.vat_rate ?? 15,
        depositPct: (project as any).deposit_percentage ?? settings?.deposit_percentage ?? 50,
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
        quotedDate: quotedDate ?? (project as any).quoted_date ?? todaySA(),
        validityDays: (settings as any)?.quote_validity_days ?? 30,
        paymentTerms: (settings as any)?.payment_terms ?? null,
        leadTime: (settings as any)?.lead_time ?? null,
      }) as any
    )

    const label = type === 'quote' ? 'Quotation' : 'Invoice'
    const subject = `${label} - ${project.project_name} - ${project.project_number}`
    const studioName = settings?.business_name ?? 'Your Studio'
    const userEmail = user.email ?? ''
    // Use the override reply-to if set in settings, otherwise fall back to the sender's own email
    const replyToEmail = settings?.email_from?.trim() || userEmail

    const plainText = customBody
      ? customBody
      : `Dear ${project.client?.client_name ?? 'Client'},\n\nPlease find attached your ${label.toLowerCase()} for ${project.project_name}.\n\nReference: ${project.project_number}\n\nKind regards,\n${studioName}${userEmail ? `\n${userEmail}` : ''}`

    const { error: resendError } = await resend.emails.send({
      from: `${studioName} <noreply@quotinghub.co.za>`,
      ...(replyToEmail ? { replyTo: replyToEmail } : {}),
      to: clientEmail,
      subject,
      text: plainText,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr>
          <td style="background-color:#4A4A47;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">${studioName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">${label}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            ${customBody
              ? customBody.split('\n').map(line =>
                  line.trim() === ''
                    ? '<div style="height:12px;"></div>'
                    : `<p style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">${escHtml(line)}</p>`
                ).join('')
              : `<p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Dear ${project.client?.client_name ?? 'Client'},</p>
                 <p style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#2C2C2A;">Please find attached your ${label.toLowerCase()} for <strong>${project.project_name}</strong>.</p>`
            }

            <!-- Reference box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:14px 18px;">
                  <p style="margin:0;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Reference</p>
                  <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:#1A1A18;">${project.project_number}</p>
                </td>
              </tr>
            </table>

            ${approvalToken ? (() => {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'
              const approveUrl = `${baseUrl}/approve/${approvalToken}?decision=approve`
              const declineUrl = `${baseUrl}/approve/${approvalToken}?decision=decline`
              return `
            <!-- Approval actions -->
            <table cellpadding="0" cellspacing="0" style="margin-top:28px;width:100%;">
              <tr>
                <td style="padding-right:8px;">
                  <a href="${approveUrl}" target="_blank"
                    style="display:block;text-align:center;padding:13px 20px;background-color:#16A34A;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">
                    ✓ &nbsp;Approve Quote
                  </a>
                </td>
                <td style="padding-left:8px;">
                  <a href="${declineUrl}" target="_blank"
                    style="display:block;text-align:center;padding:13px 20px;background-color:#F5F2EC;color:#4A4A47;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;border:1px solid #D8D3C8;">
                    Decline
                  </a>
                </td>
              </tr>
            </table>`
            })() : ''}
            <p style="margin:28px 0 0;font-size:13px;color:#8A877F;line-height:1.6;">The PDF is attached to this email. Please don't hesitate to reach out if you have any questions.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${studioName}${replyToEmail ? ` &middot; <a href="mailto:${replyToEmail}" style="color:#8A877F;text-decoration:none;">${replyToEmail}</a>` : ''}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      attachments: [{
        filename: `${type === 'quote' ? 'Quote' : 'Invoice'}-${project.project_number}.pdf`,
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

    // Auto-tick quote_sent when the quote is emailed
    if (type === 'quote') {
      const now = new Date().toISOString()
      await supabase.from('project_stages').upsert(
        { project_id: projectId, quote_sent: true, quote_sent_at: now },
        { onConflict: 'project_id' }
      )
      if ((project as any).status === 'Draft') {
        await supabase.from('projects').update({ status: 'Quote' }).eq('id', projectId)
      }
    }

    return NextResponse.json({ success: true, quote_sent: type === 'quote' })
  } catch (e: unknown) {
    console.error('[email/send]', e)
    return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
  }
  } catch (e) {
    return apiError(e)
  }
}
