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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const accountId = await resolveAccountOrStaff(user.id)
    if (!accountId) return NextResponse.json({ error: 'No account' }, { status: 403 })

    // Verify job card belongs to this account
    const { data: card } = await supabaseAdmin
      .from('elec_job_cards').select('id').eq('id', id).eq('portal_account_id', accountId).maybeSingle()
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

    return NextResponse.json(photo)
  } catch (e) { return apiError(e) }
}
