import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// GET /api/supplier-portal/requests/[recipientId] — single request detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
  const { recipientId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id, supplier_name, email, status, token, sent_at, viewed_at, responded_at, sourcing_request_id')
    .eq('id', recipientId)
    .maybeSingle()

  if (!recipient || recipient.email.toLowerCase() !== portalAccount.email.toLowerCase()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch request first to get user_id for settings lookup
  const { data: request } = await supabaseAdmin
    .from('sourcing_requests')
    .select('id, title, work_type, specifications, item_quantity, dimensions, colour_finish, status, user_id')
    .eq('id', recipient.sourcing_request_id)
    .single()

  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  const [
    { data: responses },
    { data: images },
    { data: messages },
    { data: settings },
  ] = await Promise.all([
    supabaseAdmin
      .from('sourcing_request_responses')
      .select('id, unit_price, lead_time_weeks, notes, valid_until, submitted_at, supplier_edits, changed_fields, attachment_url')
      .eq('recipient_id', recipientId)
      .limit(1),
    supabaseAdmin
      .from('sourcing_request_images')
      .select('id, url, caption, sort_order')
      .eq('sourcing_request_id', recipient.sourcing_request_id)
      .order('sort_order'),
    supabaseAdmin
      .from('sourcing_messages')
      .select('id, sender_type, body, created_at')
      .eq('recipient_id', recipientId)
      .order('created_at'),
    supabaseAdmin
      .from('settings')
      .select('business_name')
      .eq('user_id', request.user_id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    request,
    recipient: {
      id: recipient.id,
      supplier_name: recipient.supplier_name,
      status: recipient.status,
      token: recipient.token,
      sent_at: recipient.sent_at,
      viewed_at: recipient.viewed_at,
      responded_at: recipient.responded_at,
    },
    response: responses?.[0] ?? null,
    images: images ?? [],
    messages: messages ?? [],
    studio_name: settings?.business_name ?? 'Studio',
  })
  } catch (e) {
    return apiError(e)
  }
}
