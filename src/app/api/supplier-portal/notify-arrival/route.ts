import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'

// POST /api/supplier-portal/notify-arrival — supplier notifies studio that fabric/item is ready
export async function POST(req: NextRequest) {
  try {
  const { recipientId, notes } = await req.json() as { recipientId: string; notes?: string }
  if (!recipientId) return NextResponse.json({ error: 'Missing recipientId' }, { status: 400 })

  const resend = new Resend(process.env.RESEND_API_KEY)

  // Authenticate supplier portal user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('email, company_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  // Fetch sourcing request via recipient
  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id, supplier_name, email, sourcing_requests(id, title, org_id, user_id)')
    .eq('id', recipientId)
    .maybeSingle()

  if (!recipient || recipient.email.toLowerCase() !== portalAccount.email.toLowerCase()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const request = Array.isArray(recipient.sourcing_requests)
    ? recipient.sourcing_requests[0]
    : recipient.sourcing_requests as { id: string; title: string; org_id: string; user_id: string } | null

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // Get studio email from settings for this org
  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('email_from, business_name')
    .eq('org_id', request.org_id)
    .maybeSingle()

  const studioEmail = settings?.email_from
  if (!studioEmail) return NextResponse.json({ error: 'Studio email not configured' }, { status: 400 })

  const supplierDisplay = portalAccount.company_name || recipient.supplier_name || 'Your supplier'
  const studioName = settings?.business_name || 'Studio'

  await resend.emails.send({
    from: `QuotingHub Notifications <notifications@quotinghub.co.za>`,
    to: studioEmail,
    subject: `Fabric/Item Ready — ${request.title} (${supplierDisplay})`,
    html: `
      <p>Hi ${studioName},</p>
      <p><strong>${supplierDisplay}</strong> has notified you that the following is ready:</p>
      <p style="font-size:16px;font-weight:bold;">${request.title}</p>
      ${notes ? `<p><em>Note from supplier: ${notes}</em></p>` : ''}
      <p>Please arrange collection or delivery at your earliest convenience.</p>
      <p>— QuotingHub Notifications</p>
    `,
  })

  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
