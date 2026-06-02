import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024

// POST /api/capital-pieces/[id]/image — upload piece image (authenticated)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image too large (max 10 MB)' }, { status: 400 })
    if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG or WebP allowed' }, { status: 400 })

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `pieces/${id}/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('capital-hotel-images')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('capital-hotel-images')
      .getPublicUrl(path)

    // Save url back to the piece
    await supabase.from('capital_pieces').update({ image_url: publicUrl }).eq('id', id)

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    return apiError(e)
  }
}
