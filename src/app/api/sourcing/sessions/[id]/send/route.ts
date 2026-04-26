import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildEmail({
  supplierName,
  studioName,
  sessionTitle,
  projectName,
  items,
  respondUrl,
}: {
  supplierName: string
  studioName: string
  sessionTitle: string
  projectName: string | null
  items: Array<{ title: string; item_quantity: number | null; dimensions: string | null; colour_finish: string | null; specifications: string | null; work_type: string | null }>
  respondUrl: string
}) {
  const itemRows = items.map((item, i) => `
    <tr>
      <td style="padding:16px 0;${i > 0 ? 'border-top:1px solid #EDE9E1;' : ''}">
        <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#1A1A18;">${esc(item.title)}</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          ${item.work_type ? `<tr><td style="font-size:12px;color:#8A877F;padding:2px 0;width:130px;">Category</td><td style="font-size:12px;color:#2C2C2A;padding:2px 0;">${esc(item.work_type)}</td></tr>` : ''}
          ${item.item_quantity ? `<tr><td style="font-size:12px;color:#8A877F;padding:2px 0;width:130px;">Quantity</td><td style="font-size:12px;color:#2C2C2A;padding:2px 0;">${item.item_quantity}</td></tr>` : ''}
          ${item.dimensions ? `<tr><td style="font-size:12px;color:#8A877F;padding:2px 0;width:130px;">Dimensions</td><td style="font-size:12px;color:#2C2C2A;padding:2px 0;">${esc(item.dimensions)}</td></tr>` : ''}
          ${item.colour_finish ? `<tr><td style="font-size:12px;color:#8A877F;padding:2px 0;width:130px;">Colour / Finish</td><td style="font-size:12px;color:#2C2C2A;padding:2px 0;">${esc(item.colour_finish)}</td></tr>` : ''}
        </table>
        ${item.specifications ? `<p style="margin:8px 0 0;font-size:12px;color:#6B6860;line-height:1.6;white-space:pre-wrap;">${esc(item.specifications)}</p>` : ''}
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr>
          <td style="background-color:#2C2C2A;padding:32px 40px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:22px;font-weight:600;color:#F5F2EC;">${esc(studioName)}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Pricing Request</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 6px;font-size:15px;line-height:1.7;color:#2C2C2A;">Dear ${esc(supplierName)},</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              ${esc(studioName)} is requesting prices for ${items.length} item${items.length !== 1 ? 's' : ''}${projectName ? ` for <strong>${esc(projectName)}</strong>` : ''}. This is a preliminary pricing request — not a purchase order.
            </p>

            <div style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:4px 20px 4px;">
              <p style="margin:12px 0 4px;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">${esc(sessionTitle)} · ${items.length} item${items.length !== 1 ? 's' : ''}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
              <tr>
                <td align="center">
                  <a href="${respondUrl}" style="display:inline-block;background-color:#2C2C2A;color:#F5F2EC;font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;text-decoration:none;">
                    View Items &amp; Submit Prices →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:12px;color:#8A877F;line-height:1.6;">
              Or copy this link: <a href="${respondUrl}" style="color:#8A877F;">${respondUrl}</a>
            </p>
            <p style="margin:20px 0 0;font-size:12px;color:#C4BFB5;line-height:1.6;border-top:1px solid #EDE9E1;padding-top:16px;">
              Not registered yet? <a href="${SITE_URL}/supplier-portal/register" style="color:#9A7B4F;text-decoration:none;">Create a free supplier account</a> to manage all your requests in one place.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#8A877F;">${esc(studioName)} · Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// POST /api/sourcing/sessions/[id]/send
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [{ data: session }, { data: settings }] = await Promise.all([
      supabase.from('sourcing_sessions').select('*, project:projects(project_name)').eq('id', id).single(),
      supabase.from('settings').select('business_name, sourcing_enabled, email_from').maybeSingle(),
    ])

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!settings?.sourcing_enabled) return NextResponse.json({ error: 'Sourcing not enabled' }, { status: 403 })
    if (!['draft', 'sent'].includes(session.status)) {
      return NextResponse.json({ error: 'Session cannot be sent in its current state' }, { status: 400 })
    }

    // Fetch all suppliers + their assigned items
    const { data: sessionSuppliers } = await supabase
      .from('sourcing_session_suppliers')
      .select('*, assignments:sourcing_item_assignments(*, item:sourcing_session_items(*))')
      .eq('session_id', id)

    if (!sessionSuppliers?.length) {
      return NextResponse.json({ error: 'Add at least one supplier before sending' }, { status: 400 })
    }

    // Only send to suppliers who have not yet been sent (or re-send all if resending)
    const toSend = sessionSuppliers.filter(s => !s.sent_at)
    if (!toSend.length) return NextResponse.json({ error: 'All suppliers have already been sent this request' }, { status: 400 })

    const studioName = settings?.business_name ?? 'Your Studio'
    const replyTo = user.email ?? settings?.email_from ?? null
    const resend = new Resend(process.env.RESEND_API_KEY)
    const now = new Date().toISOString()

    // Fetch project name
    const projectName = (session as any).project?.project_name ?? null

    const settled = await Promise.allSettled(toSend.map(async (ss) => {
      const assignments = (ss.assignments ?? []) as any[]
      if (!assignments.length) return { id: ss.id, success: true, skipped: true }

      const items = assignments.map((a: any) => a.item).filter(Boolean)
      const respondUrl = `${SITE_URL}/sourcing/respond/${ss.token}`

      const { error: emailError } = await resend.emails.send({
        from: `${studioName} <no-reply@quotinghub.co.za>`,
        ...(replyTo ? { replyTo } : {}),
        to: ss.email,
        subject: `Pricing Request: ${session.title} — ${studioName}`,
        html: buildEmail({ supplierName: ss.supplier_name, studioName, sessionTitle: session.title, projectName, items, respondUrl }),
        text: `Dear ${ss.supplier_name},\n\n${studioName} is requesting prices for ${items.length} item(s)${projectName ? ` for ${projectName}` : ''}.\n\nItems:\n${items.map((item: any) => `- ${item.title}${item.item_quantity ? ` (Qty: ${item.item_quantity})` : ''}`).join('\n')}\n\nView and submit prices:\n${respondUrl}\n\nSent via QuotingHub`,
      })

      if (emailError) throw new Error(emailError.message)

      await supabase.from('sourcing_session_suppliers').update({ sent_at: now }).eq('id', ss.id)
      return { id: ss.id, success: true }
    }))

    const anyOk = settled.some(s => s.status === 'fulfilled' && !(s.value as any).skipped)
    if (anyOk) {
      await supabase.from('sourcing_sessions').update({ status: 'sent', ...(session.status === 'draft' ? {} : {}) }).eq('id', id)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
