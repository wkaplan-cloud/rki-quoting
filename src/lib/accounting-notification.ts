import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { computeLineItems, formatZAR } from '@/lib/quoting'
import type { LineItem } from '@/lib/types'

export interface AccountingNotificationParams {
  platform: 'sage' | 'xero'
  userId: string
  project: { id: string; project_name: string; project_number: string; design_fee: number }
  clientName: string | null | undefined
  lineItems: LineItem[]
  vatRate: number
  depositDeductionExclVat: number
  invoiceId: string | number
  isUpdate: boolean
  pushedByEmail: string
  studioName: string
  accountsEmail: string | null | undefined
}

export async function sendAccountingNotification(params: AccountingNotificationParams): Promise<void> {
  const {
    platform, userId, project, clientName, lineItems, vatRate,
    depositDeductionExclVat, invoiceId, isUpdate, pushedByEmail, studioName, accountsEmail,
  } = params

  try {
    let recipient = accountsEmail?.trim() || null

    if (!recipient) {
      const { data: membership } = await supabaseAdmin
        .from('org_members')
        .select('org_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      if (membership?.org_id) {
        const { data: admins } = await supabaseAdmin
          .from('org_members')
          .select('invited_email')
          .eq('org_id', membership.org_id)
          .eq('role', 'admin')
          .eq('status', 'active')

        const adminEmails = (admins ?? []).map((m: { invited_email: string | null }) => m.invited_email).filter(Boolean)
        recipient = adminEmails[0] ?? null
      }
    }

    if (!recipient) return

    const computed = computeLineItems(lineItems)
    const subtotal = computed.reduce((sum, c) => sum + c.total_price, 0)
    const designFeeAmt = project.design_fee > 0 ? (subtotal * project.design_fee) / 100 : 0
    const netExclVat = subtotal + designFeeAmt - depositDeductionExclVat
    const vatAmt = netExclVat * (vatRate / 100)
    const totalInclVat = netExclVat + vatAmt

    const platformLabel = platform === 'sage' ? 'Sage' : 'Xero'
    const action = isUpdate ? 'updated' : 'created'
    const projectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/projects/${project.id}`
    const pushedAt = new Date().toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      dateStyle: 'medium',
      timeStyle: 'short',
    })

    const subject = `Invoice ${action} in ${platformLabel} — ${project.project_name} (${project.project_number})`

    const rows = [
      { label: 'Subtotal (excl. VAT)', value: formatZAR(subtotal) },
      ...(designFeeAmt > 0 ? [{ label: `Design fee (${project.design_fee}%)`, value: formatZAR(designFeeAmt) }] : []),
      ...(depositDeductionExclVat > 0 ? [{ label: 'Deposit received', value: `−${formatZAR(depositDeductionExclVat)}` }] : []),
      { label: `VAT (${vatRate}%)`, value: formatZAR(vatAmt) },
      { label: 'Total (incl. VAT)', value: formatZAR(totalInclVat), bold: true },
    ]

    const rowsHtml = rows.map(r => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:${r.bold ? '#1A1A18' : '#4A4A47'};${r.bold ? 'font-weight:600;border-top:1px solid #EDE9E1;padding-top:12px;' : ''}">${r.label}</td>
        <td style="padding:8px 0;font-size:14px;text-align:right;color:${r.bold ? '#1A1A18' : '#4A4A47'};${r.bold ? 'font-weight:600;border-top:1px solid #EDE9E1;padding-top:12px;' : ''}">${r.value}</td>
      </tr>`).join('')

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: `${studioName} <noreply@quotinghub.co.za>`,
      to: recipient,
      subject,
      text: [
        subject,
        '',
        `An invoice has been ${action} in ${platformLabel} and is ready to send to the client.`,
        '',
        `Project:   ${project.project_name} (${project.project_number})`,
        clientName ? `Client:    ${clientName}` : '',
        `Pushed by: ${pushedByEmail}`,
        `Date:      ${pushedAt}`,
        `${platformLabel} invoice ID: ${invoiceId}`,
        '',
        'Invoice summary:',
        `  Subtotal (excl. VAT):           ${formatZAR(subtotal)}`,
        designFeeAmt > 0 ? `  Design fee (${project.design_fee}%):              ${formatZAR(designFeeAmt)}` : '',
        depositDeductionExclVat > 0 ? `  Deposit received:               −${formatZAR(depositDeductionExclVat)}` : '',
        `  VAT (${vatRate}%):                      ${formatZAR(vatAmt)}`,
        `  Total (incl. VAT):              ${formatZAR(totalInclVat)}`,
        '',
        'Next steps:',
        `  1. Check that all figures look correct`,
        `  2. Send the invoice to the client from within ${platformLabel}`,
        '',
        `View project in QuotingHub (login required):`,
        projectUrl,
        '',
        'Sent via QuotingHub',
      ].filter(l => l !== null && l !== undefined).join('\n'),
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
            <p style="margin:0;font-size:22px;font-weight:600;color:#F5F2EC;letter-spacing:0.01em;">${studioName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">${platformLabel} Invoice Notification</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">

            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              An invoice has been <strong>${action}</strong> in <strong>${platformLabel}</strong> and is ready to be sent to the client.
            </p>

            <!-- Project details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:16px 18px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:8px;" colspan="2">Project Details</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#8A877F;padding:3px 0;width:110px;">Project</td>
                      <td style="font-size:13px;color:#1A1A18;font-weight:600;padding:3px 0;">${project.project_name} <span style="font-weight:400;color:#8A877F;">(${project.project_number})</span></td>
                    </tr>
                    ${clientName ? `<tr>
                      <td style="font-size:13px;color:#8A877F;padding:3px 0;">Client</td>
                      <td style="font-size:13px;color:#1A1A18;padding:3px 0;">${clientName}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="font-size:13px;color:#8A877F;padding:3px 0;">Pushed by</td>
                      <td style="font-size:13px;color:#1A1A18;padding:3px 0;">${pushedByEmail}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#8A877F;padding:3px 0;">Date</td>
                      <td style="font-size:13px;color:#1A1A18;padding:3px 0;">${pushedAt}</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#8A877F;padding:3px 0;">${platformLabel} ID</td>
                      <td style="font-size:13px;color:#1A1A18;font-weight:600;padding:3px 0;">${invoiceId}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Totals -->
            <p style="margin:0 0 10px;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Invoice Summary</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EDE9E1;">
              ${rowsHtml}
            </table>

            <!-- Next steps -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td style="background-color:#FFFDF7;border:1px solid #EDE9E1;border-left:3px solid #9A7B4F;border-radius:4px;padding:16px 18px;">
                  <p style="margin:0 0 10px;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Next Steps</p>
                  <p style="margin:0 0 8px;font-size:14px;color:#2C2C2A;line-height:1.6;">1. Check that all figures look correct.</p>
                  <p style="margin:0;font-size:14px;color:#2C2C2A;line-height:1.6;">2. Send the invoice to the client from within ${platformLabel}.</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td style="border-radius:6px;background-color:#9A7B4F;">
                  <a href="${projectUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.02em;">View Project in QuotingHub →</a>
                </td>
              </tr>
            </table>
            <p style="margin:8px 0 0;font-size:11px;color:#C4BFB5;">Login required to view the project.</p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${studioName} &middot; Sent via QuotingHub</p>
            <p style="margin:4px 0 0;font-size:11px;color:#C4BFB5;">This is an automated notification. Do not reply to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    })
  } catch (e) {
    console.error('[accounting-notification]', e)
  }
}
