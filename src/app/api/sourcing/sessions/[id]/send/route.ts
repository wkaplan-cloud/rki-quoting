import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export const maxDuration = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://quotinghub.co.za'
const SUPPLIER_PORTAL_URL = process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL ?? 'https://suppliers.quotinghub.co.za'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildEmail({
  supplierName,
  studioName,
  sessionTitle,
  projectName,
  projectNumber,
  requestRef,
  items,
  respondUrl,
  isRegistered,
}: {
  supplierName: string
  studioName: string
  sessionTitle: string
  projectName: string | null
  projectNumber: string | null
  requestRef: string | null
  items: Array<{ title: string; item_quantity: number | null; dimensions: string | null; colour_finish: string | null; specifications: string | null; work_type: string | null }>
  respondUrl: string
  isRegistered: boolean
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

  const ctaUrl = respondUrl
  const ctaLabel = 'View Items &amp; Submit Prices →'
  const footer = isRegistered
    ? `<p style="margin:20px 0 0;font-size:12px;color:#8A877F;line-height:1.6;">
        Or copy this link: <a href="${respondUrl}" style="color:#8A877F;">${respondUrl}</a>
       </p>
       <p style="margin:20px 0 0;font-size:12px;color:#C4BFB5;line-height:1.6;border-top:1px solid #EDE9E1;padding-top:16px;">
        Manage all your requests in <a href="${SUPPLIER_PORTAL_URL}" style="color:#9A7B4F;text-decoration:none;">QuotingHub Supplier Portal</a>.
       </p>`
    : `<p style="margin:20px 0 0;font-size:12px;color:#8A877F;line-height:1.6;">
        Or copy this link: <a href="${respondUrl}" style="color:#8A877F;">${respondUrl}</a>
       </p>
       <p style="margin:20px 0 0;font-size:12px;color:#C4BFB5;line-height:1.6;border-top:1px solid #EDE9E1;padding-top:16px;">
         Not registered yet? <a href="${SUPPLIER_PORTAL_URL}/register" style="color:#9A7B4F;text-decoration:none;">Create a free supplier account</a> to manage all your requests in one place.
       </p>`

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
              ${esc(studioName)} is requesting prices for ${items.length} item${items.length !== 1 ? 's' : ''}${projectName ? ` for <strong>${esc(projectName)}</strong>${projectNumber ? ` <span style="color:#8A877F;font-weight:normal;">(Ref: ${esc(projectNumber)})</span>` : ''}` : ''}. This is a preliminary pricing request — not a purchase order.
            </p>

            <div style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-left:3px solid #C4A46B;border-radius:4px;padding:4px 20px 4px;">
              <p style="margin:12px 0 4px;font-size:11px;color:#8A877F;text-transform:uppercase;letter-spacing:0.08em;">${requestRef ? `${esc(requestRef)} · ` : ''}${projectNumber ? `Ref: ${esc(projectNumber)} · ` : ''}${esc(sessionTitle)} · ${items.length} item${items.length !== 1 ? 's' : ''}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemRows}
              </table>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;">
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

// POST /api/sourcing/sessions/[id]/send
// Body: { session_supplier_id?: string } — if provided, send only to that supplier
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const body = await req.json().catch(() => ({})) as { session_supplier_id?: string }

    const [{ data: session }, { data: settings }, { data: sessionSuppliers }] = await Promise.all([
      supabase.from('sourcing_sessions').select('*, project:projects(project_name, project_number)').eq('id', id).eq('org_id', orgId).single(),
      supabase.from('settings').select('business_name, email_from').maybeSingle(),
      supabase
        .from('sourcing_session_suppliers')
        .select('*, assignments:sourcing_item_assignments(*, item:sourcing_session_items(*))')
        .eq('session_id', id),
    ])

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!['draft', 'sent', 'in_progress', 'completed'].includes(session.status)) {
      return NextResponse.json({ error: 'Session cannot be sent in its current state' }, { status: 400 })
    }

    if (!sessionSuppliers?.length) {
      return NextResponse.json({ error: 'Add at least one supplier before sending' }, { status: 400 })
    }

    // If a specific supplier is requested, send only to them — otherwise send to all unsent
    const toSend = body.session_supplier_id
      ? sessionSuppliers.filter(s => s.id === body.session_supplier_id)
      : sessionSuppliers.filter(s => !s.sent_at)
    if (!toSend.length) return NextResponse.json({ error: 'All suppliers have already been sent this request' }, { status: 400 })

    const studioName = settings?.business_name ?? 'Your Studio'
    const replyTo = user.email ?? settings?.email_from ?? null
    const resend = new Resend(process.env.RESEND_API_KEY)
    const now = new Date().toISOString()

    const projectName = (session as any).project?.project_name ?? null
    const projectNumber = (session as any).project?.project_number ?? null
    const requestNumber = (session as any).request_number ?? null
    const requestRef = requestNumber ? `PR-${String(requestNumber).padStart(3, '0')}` : null

    // Resolve portal accounts by email — handles suppliers who registered after the
    // session_supplier record was created (portal_account_id would still be null on the record)
    const supplierEmails = toSend.map(ss => ss.email).filter(Boolean)
    const { data: portalAccountRows } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .select('id, email')
      .in('email', supplierEmails)
    const portalByEmail = new Map((portalAccountRows ?? []).map((a: any) => [a.email, a.id]))

    const settled = await Promise.allSettled(toSend.map(async (ss) => {
      const assignments = (ss.assignments ?? []) as any[]
      if (!assignments.length) return { id: ss.id, success: false, skipped: true, reason: `${ss.supplier_name} has no items assigned` }

      const items = assignments.map((a: any) => a.item).filter(Boolean)

      // Check portal account: prefer stored field, fall back to email lookup
      const resolvedPortalAccountId = (ss as any).portal_account_id ?? portalByEmail.get(ss.email) ?? null

      // If the record wasn't linked yet, link it now so the supplier can find it in their portal
      if (resolvedPortalAccountId && !(ss as any).portal_account_id) {
        await supabaseAdmin
          .from('sourcing_session_suppliers')
          .update({ portal_account_id: resolvedPortalAccountId })
          .eq('id', ss.id)
      }

      const isRegistered = !!resolvedPortalAccountId
      const respondUrl = isRegistered
        ? `${SUPPLIER_PORTAL_URL}/requests/${ss.id}`
        : `${SITE_URL}/sourcing/respond/${ss.token}`

      const ccEmails: string[] = (ss as any).cc_emails ?? []

      const { error: emailError } = await resend.emails.send({
        from: `${studioName} <no-reply@quotinghub.co.za>`,
        ...(replyTo ? { replyTo } : {}),
        to: ss.email,
        ...(ccEmails.length > 0 ? { cc: ccEmails } : {}),
        subject: `${requestRef ? `${requestRef} · ` : ''}Pricing Request: ${session.title} — ${studioName}`,
        html: buildEmail({ supplierName: ss.supplier_name, studioName, sessionTitle: session.title, projectName, projectNumber, requestRef, items, respondUrl, isRegistered }),
        text: `Dear ${ss.supplier_name},\n\n${studioName} is requesting prices for ${items.length} item(s)${projectName ? ` for ${projectName}` : ''}.\n\nItems:\n${items.map((item: any) => `- ${item.title}${item.item_quantity ? ` (Qty: ${item.item_quantity})` : ''}`).join('\n')}\n\nView and submit prices:\n${respondUrl}\n\nSent via QuotingHub`,
      })

      if (emailError) throw new Error(`Failed to email ${ss.supplier_name}: ${emailError.message}`)

      await supabase.from('sourcing_session_suppliers').update({ sent_at: now }).eq('id', ss.id)
      return { id: ss.id, success: true }
    }))

    const successes = settled.filter(s => s.status === 'fulfilled' && (s.value as any).success)
    const failures = settled.filter(s => s.status === 'rejected' || (s.status === 'fulfilled' && !(s.value as any).success))

    if (successes.length > 0) {
      await supabase.from('sourcing_sessions').update({ status: 'sent' }).eq('id', id)

      // Audit log — record which suppliers received this send
      const sentSupplierIds = settled
        .filter((s): s is PromiseFulfilledResult<{ id: string; success: boolean }> => s.status === 'fulfilled' && (s as any).value?.success)
        .map(s => s.value.id)
      const sentSupplierNames = toSend
        .filter(ss => sentSupplierIds.includes(ss.id))
        .map(ss => ss.supplier_name)
      await supabaseAdmin.from('audit_logs').insert({
        org_id: orgId,
        project_id: session.project_id ?? null,
        user_email: user.email ?? null,
        action: 'sent',
        table_name: 'sourcing_sessions',
        record_id: id,
        old_data: null,
        new_data: {
          session_title: session.title,
          suppliers_notified: sentSupplierNames,
          items_count: sessionSuppliers?.flatMap((ss: any) => ss.assignments ?? []).length ?? 0,
        },
      })
    }

    if (successes.length === 0) {
      const reasons = settled
        .map(s => s.status === 'rejected' ? (s as any).reason?.message : (s.value as any).reason)
        .filter(Boolean)
      return NextResponse.json({
        error: reasons.length > 0 ? reasons.join('; ') : 'No emails were sent. Make sure each supplier has at least one item assigned.',
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      sent: successes.length,
      skipped: failures.length,
    })
  } catch (e) {
    return apiError(e)
  }
}
