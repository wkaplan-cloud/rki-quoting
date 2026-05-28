import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

async function resolveAccountOrStaff(userId: string) {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id').eq('auth_user_id', userId).maybeSingle()
  if (own) return own.id
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (mem) return mem.portal_account_id
  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('portal_account_id')
    .eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  return staff?.portal_account_id ?? null
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { id, photoId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountId = await resolveAccountOrStaff(user.id)
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    // Verify ownership via job card
    const { data: photo } = await supabaseAdmin
      .from('elec_job_card_photos')
      .select('id, url, job_card_id')
      .eq('id', photoId)
      .eq('job_card_id', id)
      .maybeSingle()
    if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Delete from storage
    try {
      const url = new URL(photo.url)
      const storagePath = url.pathname.split('/job-card-photos/')[1]
      if (storagePath) {
        await supabaseAdmin.storage.from('job-card-photos').remove([storagePath])
      }
    } catch { /* ignore storage deletion errors */ }

    await supabaseAdmin.from('elec_job_card_photos').delete().eq('id', photoId)
    return NextResponse.json({ ok: true })
  } catch (e) { return apiError(e) }
}
