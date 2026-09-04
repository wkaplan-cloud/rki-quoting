import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { resolveExtrasContext } from '@/lib/job-card-extras'

// DELETE /api/supplier-portal/quoting/job-cards/[id]/extras/[extraId]
// Only while the item is still unsent — once it is on a quote, the quote owns it.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; extraId: string }> }) {
  try {
    const { id, extraId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveExtrasContext(user.id, id)
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status })

    const { data: extra } = await supabaseAdmin
      .from('elec_job_card_extras')
      .select('id, quote_id')
      .eq('id', extraId)
      .eq('job_card_id', id)
      .maybeSingle()
    if (!extra) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (extra.quote_id) {
      return NextResponse.json({ error: 'Already sent to the office — remove it on the quote instead' }, { status: 409 })
    }

    const { error } = await supabaseAdmin.from('elec_job_card_extras').delete().eq('id', extraId)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
