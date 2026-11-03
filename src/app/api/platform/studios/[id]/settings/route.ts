import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// PATCH /api/platform/studios/[id]/settings
// [id] is the org_id whose settings row we update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: orgId } = await params
  const body = await req.json()

  const allowed = ['sourcing_enabled', 'pdf_template', 'pdf_color_theme', 'studio_enabled', 'line_item_images_enabled', 'job_cost_sheet_enabled', 'delivery_timeline_enabled', 'insights_enabled', 'statements_enabled', 'agent_enabled', 'capital_hotels_enabled']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('settings')
    .update(updates)
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Switching payments on: carry any deposit amounts already typed into the old
  // single box into the payment list, so statements start from the right figure.
  if (updates.statements_enabled === true) {
    const { error: ledgerError } = await supabaseAdmin.rpc('open_payment_ledger', { p_org_id: orgId })
    if (ledgerError) return NextResponse.json({ error: `Switched on, but existing deposits were not carried over: ${ledgerError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
  } catch (e) {
    return apiError(e)
  }
}
