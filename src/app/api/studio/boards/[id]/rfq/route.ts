import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
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
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function slug(v: string) {
  return v.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'RFQ'
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
    const imageUrlByObject = new Map<string, string>()
    for (const slide of (slideRows ?? []) as StudioSlideRow[]) {
      for (const obj of Array.isArray(slide.objects) ? slide.objects : []) {
        if (obj.type === 'image') imageUrlByObject.set(obj.id, obj.url)
      }
    }

    const clientRel = (board as { clients?: { client_name: string } | { client_name: string }[] }).clients
    const clientName = (Array.isArray(clientRel) ? clientRel[0]?.client_name : clientRel?.client_name) ?? ''
    const businessName = settings?.business_name ?? 'Your Studio'
    const logoUrl = await fetchLogoBase64(settings?.logo_url)
    const replyTo = user.email ?? null
    const printDate = new Date().toLocaleDateString('en-ZA', {
      timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric',
    })

    const resend = new Resend(process.env.RESEND_API_KEY)
    const results: { email: string; supplierName: string; ok: boolean; error?: string }[] = []
    const stampsByObject = new Map<string, RfqRecipientStamp[]>()

    for (const group of groups) {
      const items: RfqPdfItem[] = []
      for (const objectId of group.objectIds) {
        const row = specByObject.get(objectId)
        if (!row) continue
        items.push({
          name: row.spec_name || '',
          imageUrl: imageUrlByObject.get(objectId) ?? null,
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
        })
      }
      if (!items.length) continue

      for (const recipient of group.recipients) {
        const email = recipient.email.trim()
        const supplierName = recipient.supplierName.trim() || email
        try {
          // Rendered per recipient (not per group) so the PDF's "To" line
          // names this supplier — nobody sees who else is pricing
          const buffer = await renderToBuffer(createElement(RfqPDF, {
            businessName,
            logoUrl,
            boardName: board.name,
            clientName,
            supplierName,
            message: (body.message ?? '').trim(),
            replyTo,
            printDate,
            items,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any)

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
              'Full specifications and images are in the attached PDF. Note that images may be',
              'reference pictures or drawings of custom pieces — please quote per the specs.',
              '',
              replyTo ? `Reply directly to this email or contact ${replyTo}.` : '',
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
                  <p style="margin:16px 0 0;font-size:12px;color:#8A877F;">${businessName}${replyTo ? ` &middot; <a href="mailto:${replyTo}" style="color:#8A877F;">${replyTo}</a>` : ''}</p>
                </div>
                <p style="text-align:center;margin:16px 0 0;font-size:11px;color:#B5B1A6;">Sent via QuotingHub</p>
              </div>
            </body></html>`,
            attachments: [{ filename, content: Buffer.from(buffer) }],
          })
          if (error) throw new Error(error.message)

          results.push({ email, supplierName, ok: true })
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

    return NextResponse.json({ results, stamps })
  } catch (e) {
    return apiError(e)
  }
}
