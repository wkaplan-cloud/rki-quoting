import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

function buildSupplierEmail({
  supplierName,
  studioName,
  title,
  quantity,
  unit,
  dimensions,
  colourFinish,
  specifications,
  respondUrl,
}: {
  supplierName: string
  studioName: string
  title: string
  quantity: number
  unit: string | null
  dimensions: string | null
  colourFinish: string | null
  specifications: string | null
  respondUrl: string
}) {
  const qtyLabel = unit ? `${quantity} ${unit}` : `${quantity}`

  const detailRows = [
    dimensions ? `<tr><td style="padding:6px 0;font-size:13px;color:#8A877F;width:130px;">Dimensions</td><td style="padding:6px 0;font-size:13px;color:#2C2C2A;">${dimensions}</td></tr>` : '',
    colourFinish ? `<tr><td style="padding:6px 0;font-size:13px;color:#8A877F;width:130px;">Colour / Finish</td><td style="padding:6px 0;font-size:13px;color:#2C2C2A;">${colourFinish}</td></tr>` : '',
  ].filter(Boolean).join('')

  const specsSection = specifications
    ? `<p style="margin:24px 0 8px;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Specifications</p>
       <p style="margin:0;font-size:13px;color:#2C2C2A;line-height:1.7;white-space:pre-wrap;">${specifications}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#2C2C2A;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:600;color:#F5F2EC;">${studioName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Pricing Request</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#2C2C2A;">Dear ${supplierName},</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              ${studioName} is requesting a price for the following item. This is a preliminary pricing request — not a purchase order.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:16px 20px;margin-bottom:24px;">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">Item</p>
                  <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#1A1A18;">${title}</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#8A877F;width:130px;">Quantity</td>
                      <td style="padding:6px 0;font-size:13px;color:#2C2C2A;">${qtyLabel}</td>
                    </tr>
                    ${detailRows}
                  </table>
                </td>
              </tr>
            </table>

            ${specsSection}

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
              <tr>
                <td align="center">
                  <a href="${respondUrl}"
                     style="display:inline-block;background-color:#2C2C2A;color:#F5F2EC;font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;text-decoration:none;">
                    View Request &amp; Submit Price →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:28px 0 0;font-size:12px;color:#8A877F;line-height:1.6;">
              You can also copy and paste this link into your browser:<br>
              <a href="${respondUrl}" style="color:#8A877F;">${respondUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${studioName}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// POST /api/sourcing/[id]/send — send to all pending recipients and lock the request
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const resend = new Resend(process.env.RESEND_API_KEY)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch request + settings in parallel
  const [{ data: request }, { data: settings }] = await Promise.all([
    supabase.from('sourcing_requests').select('*').eq('id', id).single(),
    supabase.from('settings').select('business_name, sourcing_enabled, email_from').maybeSingle(),
  ])

  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!settings?.sourcing_enabled) return NextResponse.json({ error: 'Sourcing not enabled' }, { status: 403 })
  if (request.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft requests can be sent' }, { status: 400 })
  }

  // Fetch recipients that haven't been sent yet
  const { data: recipients } = await supabase
    .from('sourcing_request_recipients')
    .select('*')
    .eq('sourcing_request_id', id)

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'Add at least one supplier before sending' }, { status: 400 })
  }

  const studioName = settings?.business_name ?? 'Your Studio'
  const replyTo = user.email || settings?.email_from?.trim() || null

  const now = new Date().toISOString()

  const settled = await Promise.allSettled(recipients.map(async (recipient) => {
    const respondUrl = `${SITE_URL}/sourcing/respond/${recipient.token}`

    const { error: emailError } = await resend.emails.send({
      from: `${studioName} <no-reply@quotinghub.co.za>`,
      ...(replyTo ? { replyTo } : {}),
      to: recipient.email,
      subject: `Pricing Request: ${request.title} — ${studioName}`,
      html: buildSupplierEmail({
        supplierName: recipient.supplier_name,
        studioName,
        title: request.title,
        quantity: request.quantity,
        unit: request.unit,
        dimensions: request.dimensions,
        colourFinish: request.colour_finish,
        specifications: request.specifications,
        respondUrl,
      }),
      text: `Dear ${recipient.supplier_name},\n\n${studioName} is requesting a price for: ${request.title}\nQuantity: ${request.quantity}${request.unit ? ' ' + request.unit : ''}\n${request.dimensions ? 'Dimensions: ' + request.dimensions + '\n' : ''}${request.specifications ? '\nSpecifications:\n' + request.specifications + '\n' : ''}\nPlease view and respond here:\n${respondUrl}\n\nThis is a preliminary pricing request — not a purchase order.\n\nSent via QuotingHub`,
    })

    if (emailError) throw new Error(emailError.message)

    // Mark as sent
    await supabase
      .from('sourcing_request_recipients')
      .update({ sent_at: now })
      .eq('id', recipient.id)

    return { recipientId: recipient.id, success: true }
  }))

  type SendResult = { recipientId: string; success: boolean; error?: string }
  const results: SendResult[] = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { recipientId: recipients[i].id, success: false, error: (s.reason as Error)?.message }
  )

  const anyOk = results.some(r => r.success)
  if (!anyOk) {
    return NextResponse.json({
      error: results.map(r => r.error ?? 'Unknown error').join('; ')
    }, { status: 500 })
  }

  // Lock the request to 'sent'
  await supabase
    .from('sourcing_requests')
    .update({ status: 'sent', sent_at: now })
    .eq('id', id)

  return NextResponse.json({ success: true, results })
}
