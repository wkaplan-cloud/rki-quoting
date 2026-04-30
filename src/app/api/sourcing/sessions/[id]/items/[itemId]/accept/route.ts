import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildAcceptanceEmail({
  supplierName,
  studioName,
  itemTitle,
  unitPrice,
  leadTimeWeeks,
  sessionTitle,
  respondUrl,
  isRegistered,
}: {
  supplierName: string
  studioName: string
  itemTitle: string
  unitPrice: number
  leadTimeWeeks: number | null
  sessionTitle: string
  respondUrl: string
  isRegistered: boolean
}) {
  const ctaUrl = isRegistered ? `${SITE_URL}/supplier-portal` : respondUrl
  const ctaLabel = isRegistered ? 'Log in to Supplier Portal →' : 'View Request →'
  const footer = isRegistered
    ? `<p style="margin:20px 0 0;font-size:12px;color:#C4BFB5;line-height:1.6;border-top:1px solid #EDE9E1;padding-top:16px;">Log in to your <a href="${SITE_URL}/supplier-portal" style="color:#9A7B4F;text-decoration:none;">Supplier Portal</a> to view all your requests.</p>`
    : `<p style="margin:20px 0 0;font-size:12px;color:#C4BFB5;line-height:1.6;border-top:1px solid #EDE9E1;padding-top:16px;">Not registered yet? <a href="${SITE_URL}/supplier-portal/register" style="color:#9A7B4F;text-decoration:none;">Create a free supplier account</a> to manage all your requests in one place.</p>`

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
            <p style="margin:6px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Price Accepted</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 32px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 6px;font-size:15px;line-height:1.7;color:#2C2C2A;">Dear ${esc(supplierName)},</p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              Great news — <strong>${esc(studioName)}</strong> has accepted your price for the following item from <em>${esc(sessionTitle)}</em>.
            </p>

            <div style="background-color:#ECFDF5;border:1px solid #A7F3D0;border-left:3px solid #10B981;border-radius:4px;padding:20px 24px;">
              <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1A1A18;">${esc(itemTitle)}</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="font-size:13px;color:#6B7280;padding:3px 0;width:130px;">Your quoted price</td><td style="font-size:13px;font-weight:700;color:#065F46;padding:3px 0;">R${unitPrice.toLocaleString()}</td></tr>
                ${leadTimeWeeks ? `<tr><td style="font-size:13px;color:#6B7280;padding:3px 0;width:130px;">Lead time</td><td style="font-size:13px;color:#065F46;padding:3px 0;">${leadTimeWeeks} week${leadTimeWeeks !== 1 ? 's' : ''}</td></tr>` : ''}
              </table>
            </div>

            <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#6B6860;">
              If you have any questions or need to confirm details, you can reply to this email or view the original request below.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr>
                <td align="center">
                  <a href="${ctaUrl}" style="display:inline-block;background-color:#2C2C2A;color:#F5F2EC;font-size:14px;font-weight:600;padding:14px 32px;border-radius:6px;text-decoration:none;">
                    ${ctaLabel}
                  </a>
                </td>
              </tr>
            </table>
            ${footer}
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

// POST /api/sourcing/sessions/[id]/items/[itemId]/accept
// Body: { assignment_id } — accept a specific supplier's response for this item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    const { id: sessionId, itemId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { assignment_id } = await req.json() as { assignment_id: string }
    if (!assignment_id) return NextResponse.json({ error: 'assignment_id is required' }, { status: 400 })

    const now = new Date().toISOString()

    // Mark the winning assignment as accepted, all others as declined
    const { data: assignments } = await supabase
      .from('sourcing_item_assignments')
      .select('id')
      .eq('item_id', itemId)

    if (!assignments?.length) return NextResponse.json({ error: 'No assignments found' }, { status: 404 })

    await Promise.all([
      supabase.from('sourcing_item_assignments')
        .update({ status: 'accepted', accepted_at: now })
        .eq('id', assignment_id),
      supabase.from('sourcing_item_assignments')
        .update({ status: 'declined' })
        .eq('item_id', itemId)
        .neq('id', assignment_id),
      supabase.from('sourcing_session_items')
        .update({ status: 'accepted' })
        .eq('id', itemId),
    ])

    // Send acceptance email — fire and forget (don't fail the accept if email fails)
    void (async () => {
      try {
        const [{ data: assignmentData }, { data: settings }] = await Promise.all([
          supabaseAdmin
            .from('sourcing_item_assignments')
            .select(`
              id,
              item:sourcing_session_items(title),
              response:sourcing_item_responses(unit_price, lead_time_weeks),
              session_supplier:sourcing_session_suppliers(supplier_name, email, token, portal_account_id)
            `)
            .eq('id', assignment_id)
            .single(),
          supabase.from('settings').select('business_name, email_from').maybeSingle(),
        ])

        if (!assignmentData) return

        const item = Array.isArray(assignmentData.item) ? assignmentData.item[0] : assignmentData.item
        const response = Array.isArray(assignmentData.response) ? assignmentData.response[0] : assignmentData.response
        const ss = Array.isArray(assignmentData.session_supplier) ? assignmentData.session_supplier[0] : assignmentData.session_supplier

        if (!item || !response || !ss?.email) return

        const { data: session } = await supabaseAdmin
          .from('sourcing_sessions')
          .select('title')
          .eq('id', sessionId)
          .single()

        const studioName = settings?.business_name ?? 'Your Studio'
        const replyTo = user.email ?? settings?.email_from ?? null
        const respondUrl = `${SITE_URL}/sourcing/respond/${ss.token}`
        const isRegistered = !!(ss as any).portal_account_id
        const ctaUrl = isRegistered ? `${SITE_URL}/supplier-portal` : respondUrl

        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: `${studioName} <no-reply@quotinghub.co.za>`,
          ...(replyTo ? { replyTo } : {}),
          to: ss.email,
          subject: `Price accepted: ${item.title} — ${studioName}`,
          html: buildAcceptanceEmail({
            supplierName: ss.supplier_name,
            studioName,
            itemTitle: item.title,
            unitPrice: response.unit_price,
            leadTimeWeeks: response.lead_time_weeks ?? null,
            sessionTitle: session?.title ?? '',
            respondUrl,
            isRegistered,
          }),
          text: `Dear ${ss.supplier_name},\n\n${studioName} has accepted your price of R${response.unit_price.toLocaleString()} for "${item.title}".\n${response.lead_time_weeks ? `Lead time: ${response.lead_time_weeks} week(s)\n` : ''}\n${isRegistered ? `Log in to your Supplier Portal: ${ctaUrl}` : `View the request: ${respondUrl}`}\n\nSent via QuotingHub`,
        })
      } catch {
        // Non-critical — accept succeeded, email failed silently
      }
    })()

    return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
