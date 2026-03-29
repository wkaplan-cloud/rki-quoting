import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    plan?: string
    status?: string
    extendDays?: number
  }

  if (body.extendDays) {
    // Extend trial: push trial_ends_at forward from today (or current expiry, whichever is later)
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('trial_ends_at')
      .eq('id', id)
      .single()

    const base = org?.trial_ends_at && new Date(org.trial_ends_at) > new Date()
      ? new Date(org.trial_ends_at)
      : new Date()

    const newExpiry = new Date(base.getTime() + body.extendDays * 86400000)

    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ trial_ends_at: newExpiry.toISOString(), subscription_status: 'trialing' })
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Update plan and/or status
  const update: Record<string, string> = {}
  if (body.plan) update.plan = body.plan
  if (body.status) update.subscription_status = body.status
  if (body.status === 'active' && !body.plan) update.plan = 'solo' // default when activating

  const { error } = await supabaseAdmin
    .from('organizations')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
