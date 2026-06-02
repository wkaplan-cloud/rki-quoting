import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_BYTES = 15 * 1024 * 1024 // 15 MB

// POST /api/capital-portal/upload — public, uploads a hotel request image
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image too large (max 15 MB)' }, { status: 400 })

    const contentType = file.type || 'image/jpeg'
    if (!ALLOWED_MIME.has(contentType) && !contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `requests/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('capital-hotel-images')
      .upload(path, buffer, { contentType, upsert: false })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('capital-hotel-images')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    return apiError(e)
  }
}
