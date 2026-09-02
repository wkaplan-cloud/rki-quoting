import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase/admin'


// Guardrails on free text a public, unauthenticated supplier can send.
const MAX_NOTE = 2000
const MAX_LEAD = 300
const MAX_MESSAGE = 2000
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// A price is optional per item, but when given it must be a sane, non-negative
// number. Anything else becomes null (treated as "not priced").
function parsePrice(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return null
  return Math.round(n * 100) / 100
}

interface SubmitItem {
  specId: string
  price: unknown
  leadTime: unknown
  note: unknown
  unableToQuote: unknown
}

// POST /api/rfq/[token]/submit
// Public — no auth. A supplier submits pricing for the items on their RFQ.
// Overwrite model: this request's prior link-submitted quotes are cleared and
// replaced, so there is one current quote per supplier per RFQ.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = (await req.json().catch(() => ({}))) as { items?: SubmitItem[]; message?: string }
    const submittedItems = Array.isArray(body.items) ? body.items : []

    const { data: request } = await supabaseAdmin
      .from('rfq_requests')
      .select('id, org_id, board_id, supplier_id, supplier_name, supplier_email, object_ids, created_by, created_by_email, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (!request) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    if (new Date(request.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This pricing link has expired' }, { status: 410 })
    }

    // The specs this request actually covers — the only ones we'll accept a
    // quote for. Scoped to the request's org (supabaseAdmin bypasses RLS).
    const { data: specs } = await supabaseAdmin
      .from('studio_specs')
      .select('id, object_id')
      .eq('org_id', request.org_id)
      .eq('board_id', request.board_id)
      .in('object_id', (request.object_ids as string[]) ?? [])
    const allowedSpecIds = new Set(((specs ?? []) as { id: string }[]).map(s => s.id))

    // Build the replacement rows — one per item the supplier engaged with
    // (priced, marked unable, or left a note/lead time). Blank items are
    // skipped so they don't clutter the log.
    const rows = submittedItems
      .filter(it => allowedSpecIds.has(it.specId))
      .map(it => {
        const price = parsePrice(it.price)
        const unable = it.unableToQuote === true
        const lead = clip(it.leadTime, MAX_LEAD)
        const note = clip(it.note, MAX_NOTE)
        return { specId: it.specId, price, unable, lead, note }
      })
      .filter(it => it.price !== null || it.unable || it.lead || it.note)
      .map(it => ({
        org_id: request.org_id,
        studio_spec_id: it.specId,
        supplier_id: request.supplier_id,
        supplier_name: request.supplier_name,
        price: it.unable ? null : it.price,
        lead_time: it.lead,
        notes: it.note,
        source: 'link',
        rfq_request_id: request.id,
        unable_to_quote: it.unable,
      }))

    if (!rows.length) {
      return NextResponse.json({ error: 'Add a price, lead time or note to at least one item.' }, { status: 400 })
    }

    // Overwrite: clear this request's previous link submissions, then insert.
    await supabaseAdmin
      .from('spec_quotes')
      .delete()
      .eq('org_id', request.org_id)
      .eq('rfq_request_id', request.id)

    const { error: insErr } = await supabaseAdmin.from('spec_quotes').insert(rows)
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    const now = new Date().toISOString()
    await supabaseAdmin
      .from('rfq_requests')
      .update({ submitted_at: now, submission_message: clip(body.message, MAX_MESSAGE) })
      .eq('id', request.id)

    await notifyDesigner(request, rows.length)

    return NextResponse.json({ ok: true, count: rows.length })
  } catch (e) {
    console.error('[rfq submit]', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Let the designer know pricing came in — in-app notification + email. Never
// let a notification failure sink the supplier's submission.
async function notifyDesigner(
  request: {
    id: string
    org_id: string
    board_id: string
    supplier_name: string
    created_by: string | null
    created_by_email: string | null
  },
  count: number
) {
  try {
    const [{ data: board }, { data: settings }] = await Promise.all([
      // The client is what the designer actually recognises — a board called
      // "Lounge" means nothing on its own across a dozen live projects
      supabaseAdmin
        .from('studio_boards')
        .select('name, clients(client_name)')
        .eq('id', request.board_id)
        .eq('org_id', request.org_id)
        .maybeSingle(),
      supabaseAdmin.from('settings').select('business_name, email_from').eq('org_id', request.org_id).maybeSingle(),
    ])
    const boardName = board?.name ?? 'a board'
    // Supabase returns a joined row as an object or a single-element array
    const clientRel = (board as { clients?: { client_name: string } | { client_name: string }[] } | null)?.clients
    const clientName =
      (Array.isArray(clientRel) ? clientRel[0]?.client_name : clientRel?.client_name)?.trim() || ''
    // "Sandra Louw · Lounge" where there's a client, plain board name otherwise
    const forLabel = clientName ? `${clientName} · ${boardName}` : boardName
    const supplier = request.supplier_name || 'A supplier'
    const itemLabel = `${count} item${count === 1 ? '' : 's'}`

    await supabaseAdmin.from('org_notifications').insert({
      org_id: request.org_id,
      type: 'rfq_quote_submitted',
      title: `${supplier} submitted pricing`,
      body: `${supplier} priced ${itemLabel} for ${forLabel}.`,
      metadata: { board_id: request.board_id, rfq_request_id: request.id, count },
    })

    const to = request.created_by_email || settings?.email_from?.trim()
    if (to) {
      const studioName = settings?.business_name ?? 'Your studio'
      await sendEmail({
        from: 'QuotingHub <noreply@quotinghub.co.za>',
        replyTo: 'hello@quotinghub.co.za',
        to,
        subject: `${supplier} submitted pricing — ${forLabel}`,
        html: buildNotificationEmail({ supplier, boardName, clientName, itemLabel, studioName }),
        text: `${supplier} submitted pricing for ${itemLabel} on ${forLabel}.\n\nOpen Quotes in QuotingHub to see the prices and apply them to a quote.`,
      })
    }
  } catch (e) {
    console.error('[rfq submit] notify failed', e)
  }
}

function buildNotificationEmail({ supplier, boardName, clientName, itemLabel, studioName }: {
  supplier: string
  boardName: string
  clientName: string
  itemLabel: string
  studioName: string
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
        <tr>
          <td style="background-color:#4A4A47;padding:28px 36px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:20px;font-weight:600;color:#F5F2EC;">${studioName}</p>
            <p style="margin:5px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Pricing received</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:36px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              <strong style="color:#9A7B4F;">${supplier}</strong> submitted pricing for <strong>${itemLabel}</strong> on <strong>${boardName}</strong>${clientName ? ` for <strong>${clientName}</strong>` : ''}.
            </p>
            <p style="margin:0;font-size:13px;line-height:1.7;color:#8A877F;">Open <strong style="color:#4A4A47;">Quotes</strong> in QuotingHub to see what they quoted and apply it to a quote's line item. Prices are not shown on the board itself.</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
            <p style="margin:0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
