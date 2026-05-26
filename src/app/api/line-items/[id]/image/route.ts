import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const MAX_BYTES = 10 * 1024 * 1024

// POST /api/line-items/[id]/image — upload an image, save URL to fabric_image_url
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!ALLOWED_IMAGE_MIME.has(file.type)) return NextResponse.json({ error: `${file.name} is not an allowed image type` }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} exceeds the 10 MB limit` }, { status: 400 })

    const ext = file.name.split('.').pop()
    const path = `line-items/${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('sourcing-images')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('sourcing-images')
      .getPublicUrl(path)

    await supabase.from('line_items').update({ fabric_image_url: publicUrl }).eq('id', id)

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/line-items/[id]/image — clear the fabric_image_url
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase.from('line_items').update({ fabric_image_url: null }).eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
