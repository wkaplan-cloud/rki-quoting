import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parsePriceInput, parseQuantityInput, formatZar, formatMetres } from '@/lib/rfq/price'
import {
  normalizeMaterial,
  normalizeScatter,
  materialQuantityAsks,
  type MaterialEntry,
  type ScatterEntry,
  type SupplierMaterialQuantity,
} from '@/lib/studio/types'


// Guardrails on free text a public, unauthenticated supplier can send.
const MAX_NOTE = 2000
const MAX_LEAD = 300
const MAX_MESSAGE = 2000
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** A spec_quotes row as it stood before this submission. */
interface PreviousRow {
  studio_spec_id: string
  price: number | string | null
  lead_time: string | null
  notes: string | null
  unable_to_quote: boolean | null
  applied_at: string | null
  applied_price: number | string | null
  material_quantities: SupplierMaterialQuantity[] | null
}

/** One difference between the last submission and this one. */
export interface PriceChange {
  name: string
  kind: 'price' | 'lead' | 'note' | 'unable' | 'added' | 'quantity'
  /** For a quantity change: which cloth moved. */
  label?: string
  from?: number | null
  to?: number | null
  fromText?: string
  toText?: string
  /** True when the studio had already carried this price onto a quote. */
  wasApplied: boolean
  appliedPrice?: number | null
  nowUnable?: boolean
}

// numeric comes back from PostgREST as a string
const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v)

interface SubmitItem {
  specId: string
  price: unknown
  leadTime: unknown
  note: unknown
  unableToQuote: unknown
  /** Metres per cloth, keyed by the ask key the form was built from. */
  quantities?: unknown
}

// POST /api/rfq/[token]/submit
// Public — no auth. A supplier submits pricing for the items on their RFQ.
//
// Merge model: a submission updates the items it carries and leaves every other
// item's answer untouched. It replaced a delete-then-insert overwrite, which
// meant a supplier coming back to correct one price briefly had no quote at all
// and lost the lot if the insert failed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = (await req.json().catch(() => ({}))) as {
      items?: SubmitItem[]
      message?: string
      revisionReason?: string
    }
    const submittedItems = Array.isArray(body.items) ? body.items : []
    const revisionReason = clip(body.revisionReason, MAX_MESSAGE)

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
      .select('id, object_id, spec_name, materials, scatters')
      .eq('org_id', request.org_id)
      .eq('board_id', request.board_id)
      .in('object_id', (request.object_ids as string[]) ?? [])
    const specRows = (specs ?? []) as {
      id: string
      spec_name: string | null
      materials: MaterialEntry[] | null
      scatters: ScatterEntry[] | null
    }[]
    const allowedSpecIds = new Set(specRows.map(s => s.id))
    const nameBySpec = new Map(specRows.map(s => [s.id, s.spec_name?.trim() || 'Untitled item']))

    // The quantity boxes this RFQ actually has, rebuilt from the spec rather
    // than trusted from the payload — the form is public, and a key that
    // isn't on the spec has no line to land on. Built by the same function
    // that built the form, so the two can't drift apart.
    const asksBySpec = new Map(
      specRows.map(sp => [
        sp.id,
        materialQuantityAsks(
          (sp.materials ?? []).map(normalizeMaterial),
          (sp.scatters ?? []).map(normalizeScatter)
        ),
      ])
    )

    // Whatever the supplier typed, exactly as it arrived. Stored before any
    // parsing so a disputed submission can always be settled from the record.
    const rawPayload = submittedItems.map(it => ({
      specId: String(it?.specId ?? ''),
      price: typeof it?.price === 'string' || typeof it?.price === 'number' ? it.price : null,
      leadTime: typeof it?.leadTime === 'string' ? it.leadTime : null,
      note: typeof it?.note === 'string' ? it.note : null,
      unableToQuote: it?.unableToQuote === true,
      quantities: Array.isArray(it?.quantities) ? it.quantities : null,
    }))

    const parsedItems = submittedItems
      .filter(it => allowedSpecIds.has(it.specId))
      .map(it => {
        const unable = it.unableToQuote === true
        const price = unable ? { value: null, error: null } : parsePriceInput(it.price)
        const typed = new Map(
          (Array.isArray(it.quantities) ? it.quantities : [])
            .filter((q): q is { key: string; quantity: unknown } => typeof (q as { key?: unknown })?.key === 'string')
            .map(q => [q.key, q.quantity])
        )
        // Driven by the asks, not by what arrived: a box the form shows is a
        // box the answer has a slot for, and a key that arrived without one
        // is dropped rather than stored against nothing.
        const quantities = (asksBySpec.get(it.specId) ?? []).map(ask => {
          const parsed = unable
            ? { value: null, error: null }
            : parseQuantityInput(typed.get(ask.key))
          return {
            key: ask.key,
            label: ask.label,
            quantity: parsed.value,
            designerQuantity: ask.designerQuantity,
            error: parsed.error,
          }
        })
        return {
          specId: it.specId,
          price: price.value,
          priceError: price.error,
          unable,
          lead: clip(it.leadTime, MAX_LEAD),
          note: clip(it.note, MAX_NOTE),
          quantities,
        }
      })

    // A price we can't read is never quietly dropped — the submission is
    // refused and the supplier is told which items to fix.
    const unreadable = parsedItems.filter(it => it.priceError)
    if (unreadable.length) {
      await logSubmission(request, rawPayload, parsedItems, unreadable.length, 0, revisionReason)
      const names = unreadable.map(it => nameBySpec.get(it.specId) ?? 'an item')
      return NextResponse.json(
        {
          error: `We couldn't read the price on ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}. Please check ${names.length === 1 ? 'it' : 'them'} and submit again.`,
          invalidSpecIds: unreadable.map(it => it.specId),
        },
        { status: 400 }
      )
    }

    // A yardage is as refusable as a price: storing an unreadable one as
    // "no answer" is how a sofa gets ordered with no cloth behind it.
    const badQty = parsedItems.filter(it => it.quantities.some(q => q.error))
    if (badQty.length) {
      await logSubmission(request, rawPayload, parsedItems, badQty.length, 0, revisionReason)
      const names = badQty.map(it => nameBySpec.get(it.specId) ?? 'an item')
      return NextResponse.json(
        {
          error: `We couldn't read a fabric quantity on ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}. Please check ${names.length === 1 ? 'it' : 'them'} and submit again.`,
          invalidSpecIds: badQty.map(it => it.specId),
        },
        { status: 400 }
      )
    }

    // One row per item the supplier engaged with (priced, declined, or left a
    // note/lead time). Blank items are skipped so they don't clutter the log.
    const engaged = parsedItems.filter(
      it =>
        it.price !== null ||
        it.unable ||
        it.lead ||
        it.note ||
        it.quantities.some(q => q.quantity !== null)
    )

    if (!engaged.length) {
      return NextResponse.json(
        { error: 'Add a price, quantity, lead time or note to at least one item.' },
        { status: 400 }
      )
    }

    // What is already on record for this request. Read before the upsert so a
    // revision can be reported as a difference rather than as a fresh
    // submission — the two used to arrive looking identical.
    const { data: previousRows } = await supabaseAdmin
      .from('spec_quotes')
      .select('studio_spec_id, price, lead_time, notes, unable_to_quote, applied_at, applied_price, material_quantities')
      .eq('org_id', request.org_id)
      .eq('rfq_request_id', request.id)
    const previous = new Map(
      ((previousRows ?? []) as PreviousRow[]).map(r => [r.studio_spec_id, r])
    )
    const isRevision = previous.size > 0

    const changes: PriceChange[] = []
    for (const it of engaged) {
      const before = previous.get(it.specId)
      if (!before) {
        if (isRevision) {
          changes.push({ name: nameBySpec.get(it.specId) ?? 'Untitled item', kind: 'added', to: it.price, wasApplied: false })
        }
        continue
      }
      const wasApplied = before.applied_at != null
      if (num(before.price) !== it.price) {
        changes.push({
          name: nameBySpec.get(it.specId) ?? 'Untitled item',
          kind: 'price',
          from: num(before.price),
          to: it.price,
          wasApplied,
          appliedPrice: num(before.applied_price),
        })
      }
      if ((before.lead_time ?? '') !== it.lead) {
        changes.push({ name: nameBySpec.get(it.specId) ?? 'Untitled item', kind: 'lead', fromText: before.lead_time ?? '', toText: it.lead, wasApplied })
      }
      if ((before.notes ?? '') !== it.note) {
        changes.push({ name: nameBySpec.get(it.specId) ?? 'Untitled item', kind: 'note', fromText: before.notes ?? '', toText: it.note, wasApplied })
      }
      if (!!before.unable_to_quote !== it.unable) {
        changes.push({ name: nameBySpec.get(it.specId) ?? 'Untitled item', kind: 'unable', to: null, wasApplied, nowUnable: it.unable })
      }
      // Metres moving matters as much as money moving: cloth may already be
      // on order against the figure this supplier gave last time.
      const beforeQty = new Map(
        (before.material_quantities ?? []).map(q => [q.key, q.quantity])
      )
      for (const q of it.quantities) {
        const was = beforeQty.get(q.key) ?? null
        if (was === q.quantity) continue
        changes.push({
          name: nameBySpec.get(it.specId) ?? 'Untitled item',
          kind: 'quantity',
          label: q.label,
          from: was,
          to: q.quantity,
          wasApplied,
        })
      }
    }
    // A price the studio has already carried onto a quote moving underneath
    // them is the case this whole flow exists to catch.
    const touchedApplied = changes.some(c => c.kind === 'price' && c.wasApplied)

    const rows = engaged.map(it => ({
      org_id: request.org_id,
      studio_spec_id: it.specId,
      supplier_id: request.supplier_id,
      supplier_name: request.supplier_name,
      price: it.price,
      lead_time: it.lead,
      notes: it.note,
      source: 'link',
      rfq_request_id: request.id,
      unable_to_quote: it.unable,
      // The whole set, every time — the form always posts every box, so a
      // cleared yardage has to clear here too rather than linger as a stale
      // figure the studio would order against.
      material_quantities: it.quantities.map(
        ({ key, label, quantity, designerQuantity }): SupplierMaterialQuantity => ({
          key,
          label,
          quantity,
          designerQuantity,
        })
      ),
    }))

    // Merge on (rfq_request_id, studio_spec_id) — see
    // supabase/rfq_submission_merge.sql for the unique index this relies on.
    // Untouched items keep whatever they already had. applied_at /
    // applied_price are deliberately absent from the payload so an upsert
    // never clears the record of a price having been used.
    const { error: insErr } = await supabaseAdmin
      .from('spec_quotes')
      .upsert(rows, { onConflict: 'rfq_request_id,studio_spec_id' })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    const pricedCount = engaged.filter(it => it.price !== null).length
    await logSubmission(request, rawPayload, parsedItems, 0, pricedCount, revisionReason)

    const now = new Date().toISOString()
    await supabaseAdmin
      .from('rfq_requests')
      .update({ submitted_at: now, submission_message: clip(body.message, MAX_MESSAGE) })
      .eq('id', request.id)

    const lines = engaged.map(it => ({
      name: nameBySpec.get(it.specId) ?? 'Untitled item',
      price: it.price,
      lead: it.lead,
      note: it.note,
      unable: it.unable,
      quantities: it.quantities
        .filter(q => q.quantity !== null)
        .map(q => ({ label: q.label, quantity: q.quantity as number })),
    }))

    await notifyDesigner(request, engaged.length, pricedCount, clip(body.message, MAX_MESSAGE), {
      isRevision,
      changes,
      touchedApplied,
      revisionReason,
      unchangedCount: engaged.length - new Set(changes.map(c => c.name)).size,
    })
    // Reported back so the confirmation screen only claims a copy was sent
    // when one actually was.
    const emailedCopy = await sendSupplierCopy(request, lines, clip(body.message, MAX_MESSAGE))

    return NextResponse.json({ ok: true, count: engaged.length, priced: pricedCount, emailedCopy })
  } catch (e) {
    console.error('[rfq submit]', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

// Every submission is recorded verbatim — what arrived, and what we made of it.
// Never let a logging failure sink the supplier's submission.
async function logSubmission(
  request: { id: string; org_id: string; supplier_name: string; supplier_email: string | null },
  rawPayload: unknown,
  parsedItems: unknown,
  rejectedCount: number,
  acceptedCount: number,
  revisionReason: string
) {
  try {
    await supabaseAdmin.from('rfq_submission_log').insert({
      rfq_request_id: request.id,
      org_id: request.org_id,
      supplier_name: request.supplier_name,
      supplier_email: request.supplier_email,
      raw_payload: rawPayload,
      parsed_items: parsedItems,
      rejected_count: rejectedCount,
      accepted_count: acceptedCount,
      revision_reason: revisionReason || null,
    })
  } catch (e) {
    console.error('[rfq submit] log failed', e)
  }
}

interface SubmittedLine {
  name: string
  price: number | null
  lead: string
  note: string
  unable: boolean
  /** Only the cloths they actually measured — blanks are not an answer. */
  quantities: { label: string; quantity: number }[]
}

// The supplier gets back exactly what we stored, so "I did send prices" is
// something either side can check instead of argue about.
async function sendSupplierCopy(
  request: { org_id: string; board_id: string; supplier_email: string | null; supplier_name: string },
  lines: SubmittedLine[],
  message: string
): Promise<boolean> {
  try {
    const to = request.supplier_email?.trim()
    if (!to) return false

    const [{ data: board }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from('studio_boards')
        .select('name, clients(client_name)')
        .eq('id', request.board_id)
        .eq('org_id', request.org_id)
        .maybeSingle(),
      supabaseAdmin.from('settings').select('business_name').eq('org_id', request.org_id).maybeSingle(),
    ])
    const studioName = settings?.business_name ?? 'The studio'
    const boardName = board?.name ?? 'your quote request'
    // Supabase returns a joined row as an object or a single-element array
    const clientRel = (board as { clients?: { client_name: string } | { client_name: string }[] } | null)?.clients
    const clientName =
      (Array.isArray(clientRel) ? clientRel[0]?.client_name : clientRel?.client_name)?.trim() || ''
    // "Gianna · HOME" — the supplier knows the job by the client, not by
    // whatever the board happens to be called
    const forLabel = clientName ? `${clientName} · ${boardName}` : boardName
    const priced = lines.filter(l => l.price !== null).length

    await sendEmail({
      from: 'QuotingHub <noreply@quotinghub.co.za>',
      replyTo: 'hello@quotinghub.co.za',
      to,
      subject: `Copy of your pricing for ${studioName} — ${boardName}`,
      html: buildSupplierCopyEmail({ studioName, forLabel, lines, priced, message }),
      text:
        `Here's a copy of the pricing you submitted to ${studioName} for ${forLabel}.\n\n` +
        lines
          .map(
            l =>
              `${l.name}: ${l.unable ? "couldn't quote" : l.price !== null ? formatZar(l.price).replace(/ /g, ' ') : 'no price given'}` +
              `${l.lead ? ` · lead time ${l.lead}` : ''}${l.note ? ` · ${l.note}` : ''}` +
              l.quantities.map(q => `\n    ${q.label}: ${formatMetres(q.quantity)}`).join('')
          )
          .join('\n') +
        `\n\n${priced} of ${lines.length} items have a price on them.` +
        `\n\nIf anything is wrong, open your pricing link again and resubmit.`,
    })
    return true
  } catch (e) {
    console.error('[rfq submit] supplier copy failed', e)
    return false
  }
}

function buildSupplierCopyEmail({
  studioName,
  forLabel,
  lines,
  priced,
  message,
}: {
  studioName: string
  /** "Gianna · HOME" — client first, board second. */
  forLabel: string
  lines: SubmittedLine[]
  priced: number
  message: string
}) {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const rows = lines
    .map(l => {
      const amount = l.unable
        ? '<span style="color:#B08968;font-style:italic;">Couldn&rsquo;t quote</span>'
        : l.price !== null
          ? `<strong style="color:#2C2C2A;">${esc(formatZar(l.price))}</strong>`
          : '<span style="color:#B4472F;">No price given</span>'
      const extras = [l.lead ? `Lead time: ${esc(l.lead)}` : '', l.note ? esc(l.note) : '']
        .filter(Boolean)
        .join(' · ')
      // The metres are half of what they sent — a receipt that only echoes
      // the money is not a receipt they can check an order against.
      const metres = l.quantities
        .map(
          q =>
            `<div style="font-size:11px;color:#8A877F;margin-top:3px;">${esc(q.label)}: <strong style="color:#4A4A47;">${esc(formatMetres(q.quantity))}</strong></div>`
        )
        .join('')
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #EDE9E1;font-size:13px;color:#4A4A47;">
          ${esc(l.name)}
          ${extras ? `<div style="font-size:11px;color:#8A877F;margin-top:3px;">${extras}</div>` : ''}
          ${metres}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #EDE9E1;font-size:13px;text-align:right;white-space:nowrap;">${amount}</td>
      </tr>`
    })
    .join('')

  const missing = lines.length - priced

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F2EC;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr>
          <td style="background-color:#4A4A47;padding:28px 36px;border-radius:8px 8px 0 0;">
            <p style="margin:0;font-size:20px;font-weight:600;color:#F5F2EC;">Your pricing</p>
            <p style="margin:5px 0 0;font-size:11px;color:#C4A46B;letter-spacing:0.08em;text-transform:uppercase;">Copy for your records</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px 36px;border-left:1px solid #EDE9E1;border-right:1px solid #EDE9E1;">
            <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#2C2C2A;">
              This is what you submitted to <strong>${esc(studioName)}</strong> for <strong>${esc(forLabel)}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
            ${
              missing > 0
                ? `<p style="margin:20px 0 0;padding:12px 14px;background-color:#FBF4E4;border-radius:6px;font-size:13px;line-height:1.6;color:#7A5F35;">
                     <strong>${missing} of ${lines.length} ${missing === 1 ? 'item has' : 'items have'} no price.</strong>
                     If that wasn&rsquo;t intended, open your pricing link again and add the amounts &mdash; everything
                     else you sent stays as it is.
                   </p>`
                : `<p style="margin:20px 0 0;font-size:13px;color:#8A877F;">All ${lines.length} items are priced.</p>`
            }
            ${
              message
                ? `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #EDE9E1;font-size:13px;line-height:1.7;color:#4A4A47;white-space:pre-line;">${esc(message)}</p>`
                : ''
            }
          </td>
        </tr>
        <tr>
          <td style="background-color:#F5F2EC;border:1px solid #EDE9E1;border-top:none;border-radius:0 0 8px 8px;padding:16px 36px;">
            <p style="margin:0;font-size:11px;color:#C4BFB5;">Sent via QuotingHub &middot; you can resubmit from your pricing link at any time</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}


const money = (n: number | null | undefined) =>
  n === null || n === undefined ? 'no price' : formatZar(n).replace(/\u00a0/g, ' ')

/** One change as a line of plain text, for the text/plain part. */
function changeAsText(c: PriceChange): string {
  switch (c.kind) {
    case 'price':
      return `${c.name}: ${money(c.from)} → ${money(c.to)}${pctLabel(c.from, c.to)}${c.wasApplied ? `  [already applied at ${money(c.appliedPrice)}]` : ''}`
    case 'lead':
      return `${c.name}: lead time ${c.fromText || 'none'} → ${c.toText || 'none'}`
    case 'note':
      return `${c.name}: note ${c.fromText || 'none'} → ${c.toText || 'none'}`
    case 'unable':
      return `${c.name}: ${c.nowUnable ? 'now marked as cannot quote' : 'no longer marked as cannot quote'}`
    case 'added':
      return `${c.name}: added, ${money(c.to)}`
    case 'quantity':
      return `${c.name} — ${c.label ?? 'fabric'}: ${metres(c.from)} → ${metres(c.to)}`
  }
}

/** A yardage for the change log, where "none" is a real answer. */
const metres = (n: number | null | undefined) =>
  n === null || n === undefined ? 'not given' : formatMetres(n)

/** One change as a table row in the notification email. */
function changeAsRow(c: PriceChange): string {
  const esc = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const rise = c.kind === 'price' && (c.to ?? 0) > (c.from ?? 0)
  const detail =
    c.kind === 'price'
      ? `<span style="color:#8A877F;text-decoration:line-through;">${esc(money(c.from))}</span>
         <span style="color:#4A4A47;">&rarr;</span>
         <strong style="color:${rise ? '#B4472F' : '#2C7A4B'};">${esc(money(c.to))}${esc(pctLabel(c.from, c.to))}</strong>`
      : c.kind === 'lead'
        ? `<span style="color:#8A877F;">lead time</span> ${esc(c.fromText || 'none')} <span style="color:#4A4A47;">&rarr;</span> <strong style="color:#2C2C2A;">${esc(c.toText || 'none')}</strong>`
        : c.kind === 'note'
          ? `<span style="color:#8A877F;">note</span> <strong style="color:#2C2C2A;">${esc(c.toText || 'removed')}</strong>`
          : c.kind === 'unable'
            ? `<strong style="color:#B08968;">${c.nowUnable ? 'Now marked cannot quote' : 'No longer marked cannot quote'}</strong>`
            : c.kind === 'quantity'
              ? `<span style="color:#8A877F;">${esc(c.label ?? 'fabric')}</span>
                 <span style="color:#8A877F;text-decoration:line-through;">${esc(metres(c.from))}</span>
                 <span style="color:#4A4A47;">&rarr;</span>
                 <strong style="color:#2C2C2A;">${esc(metres(c.to))}</strong>`
              : `<strong style="color:#2C2C2A;">Added &middot; ${esc(money(c.to))}</strong>`
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid #EDE9E1;font-size:13px;color:#4A4A47;">
      ${esc(c.name)}
      ${c.wasApplied && c.kind === 'price' ? `<div style="font-size:11px;color:#B4472F;margin-top:3px;">Already applied to a quote at ${esc(money(c.appliedPrice))}</div>` : ''}
    </td>
    <td style="padding:9px 0;border-bottom:1px solid #EDE9E1;font-size:13px;text-align:right;white-space:nowrap;">${detail}</td>
  </tr>`
}

/** "(+20%)" — the number that makes a change land at a glance. */
function pctLabel(from: number | null | undefined, to: number | null | undefined): string {
  if (!from || to === null || to === undefined) return ''
  const pct = Math.round(((to - from) / from) * 100)
  if (!Number.isFinite(pct) || pct === 0) return ''
  return ` (${pct > 0 ? '+' : ''}${pct}%)`
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
  count: number,
  pricedCount: number,
  // The supplier's "Anything else?" — terms, validity, general conditions.
  // Surfaced here because it covers the submission, not any one line item.
  supplierMessage: string,
  revision: {
    isRevision: boolean
    changes: PriceChange[]
    touchedApplied: boolean
    revisionReason: string
    unchangedCount: number
  }
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
    // Say what was actually priced — "14 items" read as a full quote once when
    // all fourteen had notes on them and not one had an amount.
    const itemLabel =
      pricedCount === 0
        ? `${count} item${count === 1 ? '' : 's'}, none with a price`
        : `${pricedCount} of ${count} item${count === 1 ? '' : 's'}`

    const { isRevision, changes, touchedApplied, revisionReason, unchangedCount } = revision
    const changedCount = new Set(changes.map(c => c.name)).size

    // A revision must never again be indistinguishable from a first
    // submission, and one that moves a price already carried onto a quote is
    // louder still.
    const title = touchedApplied
      ? `${supplier} changed a price you have already used`
      : isRevision
        ? `${supplier} revised their pricing`
        : pricedCount === 0
          ? `${supplier} replied without pricing`
          : `${supplier} submitted pricing`
    const notifBody = isRevision
      ? `${supplier} changed ${changedCount} item${changedCount === 1 ? '' : 's'} on ${forLabel}.` +
        (touchedApplied ? ' At least one is a price you have already applied to a quote.' : '')
      : `${supplier} priced ${itemLabel} for ${forLabel}.`

    await supabaseAdmin.from('org_notifications').insert({
      org_id: request.org_id,
      type: isRevision ? 'rfq_quote_revised' : 'rfq_quote_submitted',
      title,
      body: notifBody,
      metadata: {
        board_id: request.board_id,
        rfq_request_id: request.id,
        count,
        priced: pricedCount,
        revision: isRevision,
        changed: changedCount,
        touched_applied: touchedApplied,
      },
    })

    const to = request.created_by_email || settings?.email_from?.trim()
    if (to) {
      const studioName = settings?.business_name ?? 'Your studio'
      await sendEmail({
        from: 'QuotingHub <noreply@quotinghub.co.za>',
        replyTo: 'hello@quotinghub.co.za',
        to,
        subject: touchedApplied
          ? `Price changed after you used it — ${supplier} · ${forLabel}`
          : isRevision
            ? `${supplier} revised their pricing — ${forLabel}`
            : pricedCount === 0
              ? `${supplier} replied without pricing — ${forLabel}`
              : `${supplier} submitted pricing — ${forLabel}`,
        html: buildNotificationEmail({
          supplier,
          boardName,
          clientName,
          itemLabel,
          studioName,
          supplierMessage,
          isRevision,
          changes,
          touchedApplied,
          revisionReason,
          unchangedCount,
        }),
        text: isRevision
          ? `${supplier} revised their pricing on ${forLabel}.` +
            (touchedApplied
              ? `\n\nWARNING: this changes at least one price you have already applied to a quote.`
              : '') +
            (revisionReason ? `\n\nReason given: ${revisionReason}` : '') +
            `\n\n` +
            changes.map(changeAsText).join('\n') +
            (unchangedCount > 0 ? `\n\n${unchangedCount} other item${unchangedCount === 1 ? '' : 's'} unchanged.` : '') +
            `\n\nOpen Quotes in QuotingHub to review and re-apply.`
          : `${supplier} submitted pricing for ${itemLabel} on ${forLabel}.` +
            (supplierMessage ? `\n\nThey added: ${supplierMessage}` : '') +
            `\n\nOpen Quotes in QuotingHub to see the prices and apply them to a quote.`,
      })
    }
  } catch (e) {
    console.error('[rfq submit] notify failed', e)
  }
}

function buildNotificationEmail({
  supplier,
  boardName,
  clientName,
  itemLabel,
  studioName,
  supplierMessage,
  isRevision,
  changes,
  touchedApplied,
  revisionReason,
  unchangedCount,
}: {
  supplier: string
  boardName: string
  clientName: string
  itemLabel: string
  studioName: string
  supplierMessage: string
  isRevision: boolean
  changes: PriceChange[]
  touchedApplied: boolean
  revisionReason: string
  unchangedCount: number
}) {
  const esc = (t: string) =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
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
            ${
              touchedApplied
                ? `<div style="margin:0 0 20px;padding:14px 16px;background-color:#FBEDEA;border-left:3px solid #B4472F;border-radius:4px;">
                     <p style="margin:0;font-size:13px;line-height:1.7;color:#8A3A26;">
                       <strong>This changes a price you have already applied to a quote.</strong>
                       The quote still carries the old amount — nothing has been altered for you.
                       Review it in Quotes and re-apply if you accept the new price.
                     </p>
                   </div>`
                : ''
            }
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#2C2C2A;">
              ${
                isRevision
                  ? `<strong style="color:#9A7B4F;">${supplier}</strong> revised pricing they had already submitted for <strong>${boardName}</strong>${clientName ? ` for <strong>${clientName}</strong>` : ''}.`
                  : `<strong style="color:#9A7B4F;">${supplier}</strong> submitted pricing for <strong>${itemLabel}</strong> on <strong>${boardName}</strong>${clientName ? ` for <strong>${clientName}</strong>` : ''}.`
              }
            </p>
            ${
              isRevision && revisionReason
                ? `<div style="margin:0 0 16px;padding:14px 16px;background-color:#FBF4E4;border-radius:6px;">
                     <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#9A7B4F;letter-spacing:0.08em;text-transform:uppercase;">Reason they gave</p>
                     <p style="margin:0;font-size:13px;line-height:1.7;color:#7A5F35;white-space:pre-line;">${esc(revisionReason)}</p>
                   </div>`
                : ''
            }
            ${
              isRevision && changes.length
                ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                     ${changes.map(changeAsRow).join('')}
                   </table>
                   ${
                     unchangedCount > 0
                       ? `<p style="margin:0 0 16px;font-size:12px;color:#8A877F;">${unchangedCount} other item${unchangedCount === 1 ? '' : 's'} unchanged.</p>`
                       : ''
                   }`
                : ''
            }
            ${
              supplierMessage
                ? `<div style="margin:0 0 16px;padding:14px 16px;background-color:#FBF4E4;border-radius:6px;">
                     <p style="margin:0 0 6px;font-size:10px;font-weight:bold;color:#9A7B4F;letter-spacing:0.08em;text-transform:uppercase;">They added</p>
                     <p style="margin:0;font-size:13px;line-height:1.7;color:#7A5F35;white-space:pre-line;">${esc(supplierMessage)}</p>
                   </div>`
                : ''
            }
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
