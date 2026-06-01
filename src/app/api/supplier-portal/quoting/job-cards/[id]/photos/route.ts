import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

async function resolveAccountOrStaff(userId: string) {
  const { data: own } = await supabaseAdmin
    .from('supplier_portal_accounts').select('id').eq('auth_user_id', userId).maybeSingle()
  if (own) return { accountId: own.id, staffId: null as string | null, staffName: null as string | null }
  const { data: mem } = await supabaseAdmin
    .from('portal_org_members').select('portal_account_id')
    .eq('auth_user_id', userId).not('accepted_at', 'is', null).maybeSingle()
  if (mem) return { accountId: mem.portal_account_id, staffId: null as string | null, staffName: null as string | null }
  const { data: staff } = await supabaseAdmin
    .from('elec_staff').select('id, name, portal_account_id')
    .eq('auth_user_id', userId).eq('is_active', true).maybeSingle()
  if (staff) return { accountId: staff.portal_account_id, staffId: staff.id, staffName: staff.name }
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const resolved = await resolveAccountOrStaff(user.id)
    if (!resolved) return NextResponse.json({ error: 'No account' }, { status: 403 })
    const { accountId, staffId, staffName } = resolved

    // Verify job card belongs to this account
    const { data: card } = await supabaseAdmin
      .from('elec_job_cards').select('id, title').eq('id', id).eq('portal_account_id', accountId).maybeSingle()
    if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const caption = formData.get('caption') as string | null

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${accountId}/${id}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('job-card-photos')
      .upload(path, buffer, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('job-card-photos')
      .getPublicUrl(path)

    const { data: photo, error } = await supabaseAdmin
      .from('elec_job_card_photos')
      .insert({ job_card_id: id, url: publicUrl, caption: caption ?? null })
      .select().single()
    if (error) throw error

    if (staffId) {
      supabaseAdmin.from('elec_notifications').insert({
        portal_account_id: accountId,
        type: 'job_card_photo',
        title: `Photo uploaded by ${staffName ?? 'staff'}`,
        body: card.title ? `On job card "${card.title}"` : `On job card ${id.slice(0, 8)}`,
        metadata: { job_card_id: id, staff_id: staffId, photo_url: photo.url },
      })
    }

    return NextResponse.json(photo)
  } catch (e) { return apiError(e) }
}
