import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveAccountOrStaff } from '@/lib/portal-account'
import { apiError } from '@/lib/api-error'
import type { ElecCOC } from '@/lib/elec-types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveAccountOrStaff(user.id)
    if (!resolved) return NextResponse.json({ error: 'No account' }, { status: 404 })
    const { accountId } = resolved

    const body = await req.json() as Partial<ElecCOC>

    // Verify ownership
    if (body.quote_id) {
      const { data: q } = await supabaseAdmin.from('elec_quotes').select('id').eq('id', body.quote_id).eq('portal_account_id', accountId).maybeSingle()
      if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (body.job_card_id) {
      const { data: jc } = await supabaseAdmin.from('elec_job_cards').select('id').eq('id', body.job_card_id).eq('portal_account_id', accountId).maybeSingle()
      if (!jc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let { error } = await supabaseAdmin.from('elec_coc').upsert({
      ...body,
      portal_account_id: accountId,
    })

    // Fallback while the photos migration hasn't been run yet
    if (error?.code === '42703') {
      const { photos: _skip, ...withoutPhotos } = body
      ;({ error } = await supabaseAdmin.from('elec_coc').upsert({
        ...withoutPhotos,
        portal_account_id: accountId,
      }))
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
