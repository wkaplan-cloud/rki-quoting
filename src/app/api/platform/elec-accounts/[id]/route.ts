import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const PLATFORM_ADMIN = process.env.PLATFORM_ADMIN_EMAIL

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== PLATFORM_ADMIN?.toLowerCase()) return null
  return user
}

// PATCH /api/platform/elec-accounts/[id]
// Update plan, subscription_status, notes on a contractor account
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requirePlatformAdmin()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      plan?: string
      subscription_status?: string
      admin_notes?: string
    }

    const patch: Record<string, string | null> = {}
    if (body.plan               !== undefined) patch.plan                = body.plan
    if (body.subscription_status !== undefined) patch.subscription_status = body.subscription_status
    if (body.admin_notes         !== undefined) patch.admin_notes         = body.admin_notes

    const { data, error } = await supabaseAdmin
      .from('supplier_portal_accounts')
      .update(patch)
      .eq('id', id)
      .select('id, plan, subscription_status')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, account: data })
  } catch (e) { return apiError(e) }
}
