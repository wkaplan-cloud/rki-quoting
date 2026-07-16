import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'

const ORG_ID = process.env.CAPITAL_HOTEL_ORG_ID
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// POST /api/capital-portal/submit — public, creates a capital_request + items and emails RKI
export async function POST(req: NextRequest) {
  try {
    if (!ORG_ID) return NextResponse.json({ error: 'Portal not configured' }, { status: 503 })

    const body = await req.json() as {
      hotel_id: string
      hotel_name: string
      items: { description: string; quantity: number; image_url: string | null; sort_order: number }[]
    }

    if (!body.hotel_id || !body.hotel_name) return NextResponse.json({ error: 'Hotel is required' }, { status: 400 })
    if (!body.items?.length) return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })

    // Validate hotel belongs to this org
    const { data: hotel } = await supabaseAdmin
      .from('capital_hotels')
      .select('id, name')
      .eq('id', body.hotel_id)
      .eq('org_id', ORG_ID)
      .eq('active', true)
      .single()

    if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })

    // Create the request
    const { data: request, error: reqError } = await supabaseAdmin
      .from('capital_requests')
      .insert({
        org_id: ORG_ID,
        hotel_id: hotel.id,
        hotel_name: hotel.name,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (reqError || !request) return NextResponse.json({ error: reqError?.message ?? 'Failed to create request' }, { status: 500 })

    // Insert all items
    const itemRows = body.items.map(item => ({
      request_id: request.id,
      org_id: ORG_ID,
      description: item.description,
      quantity: item.quantity,
      image_url: item.image_url ?? null,
      sort_order: item.sort_order,
    }))

    await supabaseAdmin.from('capital_request_items').insert(itemRows)

    // Send notification email to RKI
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('capital_hotel_email, business_name')
      .eq('org_id', ORG_ID)
      .maybeSingle()

    const notifyEmail = settings?.capital_hotel_email ?? process.env.CONTACT_NOTIFICATION_EMAIL
    if (notifyEmail && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const itemsHtml = body.items.map((item, i) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#1A1A18;">${i + 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#1A1A18;">${esc(item.description)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;color:#1A1A18;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:13px;">
            ${item.image_url ? `<a href="${esc(item.image_url)}" style="color:#1B4F8A;">View image</a>` : '<span style="color:#8A877F;">No image</span>'}
          </td>
        </tr>
      `).join('')

      await resend.emails.send({
        from: 'QuotingHub <noreply@quotinghub.co.za>',
        replyTo: 'hello@quotinghub.co.za',
        to: notifyEmail,
        subject: `[Capital Hotel] New request from ${hotel.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#F5F2EC;border-radius:8px;">
            <h2 style="margin:0 0 4px;font-size:20px;color:#1A1A18;">New Maintenance Request</h2>
            <p style="margin:0 0 16px;font-size:14px;color:#8A877F;">
              <strong style="color:#1A1A18;">${esc(hotel.name)}</strong> — ${new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #E8E4DC;">
              <thead>
                <tr style="background:#1B4F8A;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;color:white;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">#</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;color:white;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
                  <th style="padding:10px 12px;text-align:center;font-size:11px;color:white;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;color:white;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Photo</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <div style="margin-top:24px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/capital-hotels/${request.id}" style="display:inline-block;background:#1B4F8A;color:white;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;">
                Open in QuotingHub →
              </a>
            </div>
          </div>
        `,
      }).catch(() => {}) // don't fail the submission if email errors
    }

    return NextResponse.json({ ok: true, request_id: request.id })
  } catch (e) {
    return apiError(e)
  }
}
