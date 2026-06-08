import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

interface PushSubscriptionBody {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// POST — save a push subscription for the logged-in staff member
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, portal_account_id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!staff) return NextResponse.json({ error: 'Not a staff member' }, { status: 403 })

    const body = await req.json() as PushSubscriptionBody
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    await supabaseAdmin.from('elec_staff_push_subscriptions').upsert({
      staff_id:          staff.id,
      portal_account_id: staff.portal_account_id,
      endpoint:          body.endpoint,
      p256dh:            body.keys.p256dh,
      auth:              body.keys.auth,
      user_agent:        req.headers.get('user-agent') ?? null,
    }, { onConflict: 'staff_id,endpoint' })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE — remove a subscription (staff unsubscribed / denied permission)
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!staff) return NextResponse.json({ ok: true })

    const { endpoint } = await req.json() as { endpoint: string }
    if (endpoint) {
      await supabaseAdmin
        .from('elec_staff_push_subscriptions')
        .delete()
        .eq('staff_id', staff.id)
        .eq('endpoint', endpoint)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
