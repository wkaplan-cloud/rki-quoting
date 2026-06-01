import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: staff } = await supabaseAdmin
      .from('elec_staff')
      .select('id, portal_account_id, is_active')
      .eq('auth_user_id', user.id)
      .single()
    if (!staff || !staff.is_active) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Verify project is assigned to this staff member
    const { data: quote } = await supabaseAdmin
      .from('elec_quotes')
      .select('id')
      .eq('id', id)
      .eq('portal_account_id', staff.portal_account_id)
      .eq('staff_id', staff.id)
      .single()
    if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const form = await req.formData()
    const file = form.get('file') as File | null
    const caption = form.get('caption') as string | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `quote-photos/${id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('job-card-photos')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage.from('job-card-photos').getPublicUrl(path)

    const { data: photo, error } = await supabaseAdmin
      .from('elec_quote_photos')
      .insert({
        quote_id: id,
        portal_account_id: staff.portal_account_id,
        url: publicUrl,
        caption: caption || null,
        uploaded_by_staff_id: staff.id,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(photo)
  } catch (e) {
    return apiError(e)
  }
}
