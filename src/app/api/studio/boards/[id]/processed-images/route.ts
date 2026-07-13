import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { randomUUID } from 'crypto'

// POST /api/studio/boards/[id]/processed-images — store a background-removed
// variant of a board image. Separate from the main images route on purpose:
// the file must keep its alpha channel (PNG/WebP, stored byte-for-byte, no
// JPEG normalisation), the size cap is higher (transparent PNGs of large
// photos are heavy when the browser can't encode WebP), and results are NOT
// registered in the asset library — they're variants of an existing image,
// not new assets.
const ALLOWED_MIME = new Set(['image/png', 'image/webp'])
const MAX_BYTES = 20 * 1024 * 1024

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Security: verify the board belongs to this org before the storage write —
    // supabaseAdmin bypasses RLS (same pattern as the images route)
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: board } = await supabase
      .from('studio_boards')
      .select('id')
      .eq('id', boardId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Only PNG or WebP allowed' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Processed image exceeds the 20 MB limit' }, { status: 400 })
    }

    const ext = file.type === 'image/webp' ? 'webp' : 'png'
    const path = `${orgId}/${boardId}/bg-removed/${randomUUID()}.${ext}`
    const { error } = await supabaseAdmin.storage
      .from('studio-images')
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabaseAdmin.storage.from('studio-images').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (e) {
    return apiError(e)
  }
}
