import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createElement } from 'react'
import sharp from 'sharp'
import { renderPdfToBuffer } from '@/lib/pdf/render'
import { createClient } from '@/lib/supabase/server'
import { RfqPDF, type RfqPdfItem } from '@/lib/pdf/RfqPDF'
import { fetchLogoBase64 } from '@/lib/pdf/fetchLogoBase64'
import { apiError } from '@/lib/api-error'
import { normalizeMaterial, type StudioSpecRow, type StudioSlideRow, type RfqRecipientStamp } from '@/lib/studio/types'

export const maxDuration = 60

interface RfqRecipient {
  supplierId: string | null
  supplierName: string
  email: string
}

interface RfqGroup {
  objectIds: string[]
  recipients: RfqRecipient[]
}

interface RfqBody {
  groups: RfqGroup[]
  message: string
  force?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// A resend to the same supplier for the same item within this window is far
// more likely an accidental duplicate (double-click, reopened modal, retried
// request) than a deliberate resend — so it's blocked unless the client
// confirms with force:true. Longer gaps are assumed intentional (chasing a
// non-responsive supplier) and go straight through.
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000

function slug(v: string) {
  return v.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'RFQ'
}

// Images embedded in the RFQ PDF only — the stored originals are untouched.
// Boards store up to 3600px; an A4 content column (~505pt ≈ 7in) is
// print-crisp at ~170dpi with 1200px, so this cuts a photo-heavy 50-item
// PDF from ~20MB to a few MB with no visible difference to the supplier.
const PDF_IMAGE_MAX_PX = 1200

async function downscaleForPdf(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const out = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate() // honour EXIF orientation
      .resize(PDF_IMAGE_MAX_PX, PDF_IMAGE_MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }) // bg-removed PNGs land on paper white
      .jpeg({ quality: 80 })
      .toBuffer()
    return `data:image/jpeg;base64,${out.toString('base64')}`
  } catch {
    return url // never break a send over a resize — fall back to the original
  }
}

// POST /api/studio/boards/[id]/rfq — email quote-request PDFs to suppliers.
// One email per recipient (comparison suppliers never see each other), each
// carrying a PDF of that group's items with full specs. Stamps rfq_sent_at /
// rfq_sent_to on the specs afterwards.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: board } = await supabase
      .from('studio_boards')
      .select('id, name, client_id, clients(client_name)')
      .eq('id', boardId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = (await req.json()) as RfqBody
    const groups = (body.groups ?? []).filter(g => g.objectIds?.length && g.recipients?.length)
    if (!groups.length) return NextResponse.json({ error: 'Nothing to send' }, { status: 400 })
    for (const g of groups) {
      for (const r of g.recipients) {
        if (!EMAIL_RE.test(r.email?.trim() ?? '')) {
          return NextResponse.json(
            { error: `"${r.email ?? ''}" is not a valid email address (${r.supplierName || 'recipient'})` },
            { status: 400 }
          )
        }
      }
    }

    const allObjectIds = [...new Set(groups.flatMap(g => g.objectIds))]

    const [{ data: specRows }, { data: slideRows }, { data: settings }] = await Promise.all([
      supabase.from('studio_specs').select('*').eq('board_id', boardId).in('object_id', allObjectIds),
      supabase.from('studio_slides').select('id, board_id, org_id, name, heading, sort_order, objects').eq('board_id', boardId),
      supabase.from('settings').select('business_name, logo_url').maybeSingle(),
    ])

    const specByObject = new Map((specRows ?? []).map(r => [(r as StudioSpecRow).object_id, r as StudioSpecRow]))

    if (!body.force) {
      const now = Date.now()
      const dupes: { item: string; supplierName: string; email: string; minutesAgo: number }[] = []
      for (const group of groups) {
        for (const objectId of group.objectIds) {
          const row = specByObject.get(objectId)
          if (!row) continue
          const history = Array.isArray(row.rfq_sent_to) ? (row.rfq_sent_to as RfqRecipientStamp[]) : []
          for (const recipient of group.recipients) {
            const email = recipient.email.trim().toLowerCase()
            const match = history.find(
              h => h.email?.trim().toLowerCase() === email && now - new Date(h.at).getTime() < DUPLICATE_WINDOW_MS
            )
            if (match) {
              dupes.push({
                item: row.spec_name || 'Untitled item',
                supplierName: recipient.supplierName || email,
                email,
                minutesAgo: Math.max(1, Math.round((now - new Date(match.at).getTime()) / 60000)),
              })
            }
          }
        }
      }
      if (dupes.length) {
        return NextResponse.json({ error: 'duplicate_rfq', dupes }, { status: 409 })
      }
    }

    const imageUrlByObject = new Map<string, string>()
    // Room/area = the heading of the slide the object actually sits on
    const areaByObject = new Map<string, string>()
    for (const slide of (slideRows ?? []) as StudioSlideRow[]) {
      const area = (slide.heading || slide.name || '').trim()
      for (const obj of Array.isArray(slide.objects) ? slide.objects : []) {
        if (obj.type === 'image') imageUrlByObject.set(obj.id, obj.url)
        areaByObject.set(obj.id, area)
      }
    }

    // Downscale each unique image once, shared across groups/recipients
    const uniquePdfUrls = [
      ...new Set(allObjectIds.map(id => imageUrlByObject.get(id)).filter((u): u is string => !!u)),
    ]
    const pdfImageByUrl = new Map<string, string>()
    await Promise.all(
      uniquePdfUrls.map(async u => {
        pdfImageByUrl.set(u, await downscaleForPdf(u))
      })
    )

    const clientRel = (board as { clients?: { client_name: string } | { client_name: string }[] }).clients
    const clientName = (Array.isArray(clientRel) ? clientRel[0]?.client_name : clientRel?.client_name) ?? ''
    const businessName = settings?.business_name ?? 'Your Studio'
    const logoUrl = await fetchLogoBase64(settings?.logo_url)
    const replyTo = user.email ?? null
    const printDate = new Date().toLocaleDateString('en-ZA', {
      timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric',
    })

    // Self-serve pricing links live for 30 days from send.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://quotinghub.co.za'
    const linkExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const resend = new Resend(process.env.RESEND_API_KEY)
    const results: { email: string; supplierName: string; ok: boolean; error?: string }[] = []
    const stampsByObject = new Map<string, RfqRecipientStamp[]>()
    // rfq_requests rows to persist — one per email that actually sent. Built
    // during the loop, inserted once at the end so a failed send leaves no
    // orphan link.
    const rfqRequestRows: {
      token: string
      org_id: string
      board_id: string
      supplier_id: string | null
      supplier_name: string
      supplier_email: string
      object_ids: string[]
      message: string
      created_by: string
      created_by_email: string | null
      expires_at: string
    }[] = []

    for (const group of groups) {
      const items: RfqPdfItem[] = []
      for (const objectId of group.objectIds) {
        const row = specByObject.get(objectId)
        if (!row) continue
        const originalUrl = imageUrlByObject.get(objectId)
        items.push({
          name: row.spec_name || '',
          area: areaByObject.get(objectId) ?? '',
          imageUrl: originalUrl ? pdfImageByUrl.get(originalUrl) ?? originalUrl : null,
          description: row.description ?? '',
          category: row.category ?? '',
          quantity: row.quantity ?? '',
          unit: row.unit ?? '',
          width: row.width ?? '',
          depth: row.depth ?? '',
          height: row.height ?? '',
          materials: (Array.isArray(row.materials) ? row.materials.map(normalizeMaterial) : []).map(m => ({
            type: m.type, description: m.description, supplierName: m.supplierName, colour: m.colour,
          })),
          notes: row.notes ?? '',
          itemSpecs: row.item_specs ?? {},
        })
      }
      if (!items.length) continue

      for (const recipient of group.recipients) {
        const email = recipient.email.trim()
        const supplierName = recipient.supplierName.trim() || email
        // Token minted up front so it can go in the email; the rfq_requests
        // row is only persisted below once the send actually succeeds.
        const token = crypto.randomUUID()
        const pricingUrl = `${baseUrl}/rfq/${token}`
        try {
          // Rendered per recipient (not per group) so the PDF's "To" line
          // names this supplier — nobody sees who else is pricing
          const buffer = await renderPdfToBuffer(createElement(RfqPDF, {
            businessName,
            logoUrl,
            boardName: board.name,
            clientName,
            supplierName,
            message: (body.message ?? '').trim(),
            replyTo,
            printDate,
            items,
          }))

          const subject = `Request for quote — ${board.name}${clientName ? ` (${clientName})` : ''}`
          const filename = `${slug(businessName)}_RFQ_${slug(board.name)}.pdf`
          const intro = (body.message ?? '').trim()
          const { error } = await resend.emails.send({
            from: `${businessName} <noreply@quotinghub.co.za>`,
            to: email,
            ...(replyTo ? { replyTo } : {}),
            subject,
            text: [
              `Hi ${supplierName},`,
              '',
              intro || `Please could you quote on the ${items.length === 1 ? 'item' : `${items.length} items`} in the attached document.`,
              '',
              'Enter your pricing online — one price per item, plus lead time and notes:',
              pricingUrl,
              '(link valid for 30 days)',
              '',
              'Full specifications and images are in the attached PDF. Note that images may be',
              'reference pictures or drawings of custom pieces — please quote per the specs.',
              '',
              replyTo ? `Prefer email? Reply directly to this message or contact ${replyTo}.` : '',
              '',
              `${businessName} · Sent via QuotingHub`,
            ].filter(l => l !== null).join('\n'),
            html: `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#F5F2EC;font-family:Arial,Helvetica,sans-serif;">
              <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
                <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #E5E0D6;">
                  <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9A7B4F;font-weight:bold;">Request for quote</p>
                  <h1 style="margin:0 0 16px;font-size:20px;color:#1A1A18;">${board.name}${clientName ? ` — ${clientName}` : ''}</h1>
                  <p style="margin:0 0 12px;font-size:14px;color:#4A4A47;line-height:1.6;">Hi ${supplierName},</p>
                  <p style="margin:0 0 12px;font-size:14px;color:#4A4A47;line-height:1.6;">${intro ? intro.replace(/\n/g, '<br/>') : `Please could you quote on the ${items.length === 1 ? 'item' : `${items.length} items`} in the attached document.`}</p>
                  <p style="margin:0 0 12px;font-size:13px;color:#8A877F;line-height:1.6;">Full specifications and images are in the attached PDF. Images may be reference pictures or drawings of custom pieces — please quote per the specs.</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;"><tr><td style="border-radius:8px;background:#9A7B4F;">
                    <a href="${pricingUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">Enter your pricing online &rarr;</a>
                  </td></tr></table>
                  <p style="margin:0 0 12px;font-size:12px;color:#8A877F;line-height:1.6;">Add a price per item, plus lead time and any notes. ${replyTo ? 'Prefer email? Just reply to this message.' : ''} This link is valid for 30 days.</p>
                  <p style="margin:16px 0 0;font-size:12px;color:#8A877F;">${businessName}${replyTo ? ` &middot; <a href="mailto:${replyTo}" style="color:#8A877F;">${replyTo}</a>` : ''}</p>
                </div>
                <p style="text-align:center;margin:16px 0 0;font-size:11px;color:#B5B1A6;">Sent via QuotingHub</p>
              </div>
            </body></html>`,
            attachments: [{ filename, content: Buffer.from(buffer) }],
          })
          if (error) throw new Error(error.message)

          results.push({ email, supplierName, ok: true })
          // Persist the self-serve link only now that the email is out — a
          // failed send leaves no dangling token. Only the specs that exist
          // are quotable, so filter object_ids to real specs.
          rfqRequestRows.push({
            token,
            org_id: orgId,
            board_id: boardId,
            supplier_id: recipient.supplierId,
            supplier_name: supplierName,
            supplier_email: email,
            object_ids: group.objectIds.filter(id => specByObject.has(id)),
            message: intro,
            created_by: user.id,
            created_by_email: user.email ?? null,
            expires_at: linkExpiresAt,
          })
          const at = new Date().toISOString()
          for (const objectId of group.objectIds) {
            if (!specByObject.has(objectId)) continue
            const list = stampsByObject.get(objectId) ?? []
            list.push({ supplierName, email, at })
            stampsByObject.set(objectId, list)
          }
        } catch (e) {
          results.push({ email, supplierName, ok: false, error: (e as Error).message || 'Send failed' })
        }
      }
    }

    // Stamp the specs that actually went out (merge onto existing history)
    const stamps: { objectId: string; at: string; recipients: RfqRecipientStamp[] }[] = []
    for (const [objectId, recipients] of stampsByObject) {
      const row = specByObject.get(objectId)!
      const at = recipients[recipients.length - 1].at
      const history = [...(Array.isArray(row.rfq_sent_to) ? row.rfq_sent_to : []), ...recipients]
      await supabase
        .from('studio_specs')
        .update({ rfq_sent_at: at, rfq_sent_to: history })
        .eq('board_id', boardId)
        .eq('object_id', objectId)
      stamps.push({ objectId, at, recipients })
    }

    // Persist the self-serve pricing links for every email that went out.
    // Non-fatal: a failure here just means suppliers can't use the online
    // form (they can still reply by email), so never fail the send over it.
    if (rfqRequestRows.length) {
      const { error: rfqErr } = await supabase.from('rfq_requests').insert(rfqRequestRows)
      if (rfqErr) console.error('[rfq] failed to persist pricing links', rfqErr.message)
    }

    return NextResponse.json({ results, stamps })
  } catch (e) {
    return apiError(e)
  }
}
