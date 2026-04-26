import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// GET /api/supplier-portal/requests — list all price requests for this supplier's email
export async function GET() {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get portal account (and email)
  const { data: portalAccount } = await supabaseAdmin
    .from('supplier_portal_accounts')
    .select('id, email')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!portalAccount) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

  // Fetch all recipients matching this email
  const { data: recipients, error } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select(`
      id,
      supplier_name,
      email,
      status,
      sent_at,
      viewed_at,
      responded_at,
      sourcing_requests (
        id,
        title,
        work_type,
        status,
        sent_at,
        user_id
      )
    `)
    .eq('email', portalAccount.email)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch studio names for each unique user_id
  const userIds = [...new Set(
    (recipients ?? [])
      .map(r => {
        const req = Array.isArray(r.sourcing_requests) ? r.sourcing_requests[0] : r.sourcing_requests
        return req?.user_id as string | undefined
      })
      .filter(Boolean)
  )]

  const studioMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('user_id, business_name')
      .in('user_id', userIds)
    for (const s of settingsRows ?? []) {
      if (s.user_id) studioMap[s.user_id] = s.business_name ?? 'Studio'
    }
  }

  const result = (recipients ?? []).map(r => {
    const req = Array.isArray(r.sourcing_requests) ? r.sourcing_requests[0] : r.sourcing_requests
    return {
      recipient_id: r.id,
      supplier_name: r.supplier_name,
      status: r.status,
      sent_at: r.sent_at,
      viewed_at: r.viewed_at,
      responded_at: r.responded_at,
      request: req ? {
        id: req.id,
        title: req.title,
        work_type: req.work_type,
        status: req.status,
        sent_at: req.sent_at,
      } : null,
      studio_name: req?.user_id ? (studioMap[req.user_id] ?? 'Studio') : 'Studio',
    }
  })

  return NextResponse.json({ requests: result })
  } catch (e) {
    return apiError(e)
  }
}
