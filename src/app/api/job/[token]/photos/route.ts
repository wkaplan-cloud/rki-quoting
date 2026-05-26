import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: job } = await supabaseAdmin
      .from('elec_jobs')
      .select('id, portal_account_id')
      .eq('share_token', token)
      .single()
    if (!job) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('photo') as File | null
    const uploadedByName = (formData.get('name') as string | null)?.trim() || null

    if (!file) return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Photo too large (max 8MB)' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const storagePath = `${job.portal_account_id}/${job.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await supabaseAdmin.storage
      .from('job-photos')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('job-photos')
      .getPublicUrl(storagePath)

    const { data: photo, error: dbError } = await supabaseAdmin
      .from('elec_job_photos')
      .insert({
        job_id: job.id,
        portal_account_id: job.portal_account_id,
        storage_path: storagePath,
        public_url: publicUrl,
        file_name: file.name,
        uploaded_by_name: uploadedByName,
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
    return NextResponse.json(photo)
  } catch (e) {
    return apiError(e)
  }
}
