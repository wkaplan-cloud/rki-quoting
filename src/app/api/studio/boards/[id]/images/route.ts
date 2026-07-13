import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { randomUUID, createHash } from 'crypto'
import type { StudioAssetRow } from '@/lib/studio/types'

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 8 * 1024 * 1024

export const maxDuration = 60

// POST /api/studio/boards/[id]/images — upload board images (already
// compressed client-side). Every upload is registered in studio_assets,
// deduplicated by content hash: re-importing the same picture resolves to the
// existing file instead of storing it twice. Storage writes must go through
// supabaseAdmin: the buckets have no client INSERT policies.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Security: verify the board belongs to this org before the storage write.
    // supabaseAdmin bypasses RLS, so without this check any authenticated user
    // could write files into any org's board storage path.
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
    const files = formData.getAll('files') as File[]
    const widths = formData.getAll('widths').map(Number)
    const heights = formData.getAll('heights').map(Number)
    if (!files.length) return NextResponse.json({ urls: [], assets: [] })

    for (const file of files) {
      if (!ALLOWED_IMAGE_MIME.has(file.type)) {
        return NextResponse.json({ error: `${file.name} is not an allowed image type` }, { status: 400 })
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: `${file.name} exceeds the 8 MB limit` }, { status: 400 })
      }
    }

    const urls: string[] = []
    const assets: (StudioAssetRow | null)[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const bytes = await file.arrayBuffer()
      const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex')

      // Duplicate? Reuse the existing asset — no second storage write.
      // Asset registration is best-effort so uploads keep working even if
      // the studio_assets migration hasn't been applied yet.
      const { data: existing } = await supabaseAdmin
        .from('studio_assets')
        .select('*')
        .eq('board_id', boardId)
        .eq('org_id', orgId)
        .eq('hash', hash)
        .maybeSingle()
      if (existing) {
        urls.push(existing.url)
        assets.push(existing as StudioAssetRow)
        continue
      }

      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${orgId}/${boardId}/${randomUUID()}.${ext}`
      const { error } = await supabaseAdmin.storage
        .from('studio-images')
        .upload(path, bytes, { contentType: file.type, upsert: false })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const { data } = supabaseAdmin.storage.from('studio-images').getPublicUrl(path)
      urls.push(data.publicUrl)

      const { data: asset, error: assetError } = await supabaseAdmin
        .from('studio_assets')
        .insert({
          board_id: boardId,
          org_id: orgId,
          url: data.publicUrl,
          hash,
          natural_width: widths[i] || 0,
          natural_height: heights[i] || 0,
          file_size: file.size,
        })
        .select('*')
        .single()
      if (assetError) {
        // Unique(board_id, hash) race — a parallel upload of the same file won
        const { data: raced } = await supabaseAdmin
          .from('studio_assets')
          .select('*')
          .eq('board_id', boardId)
          .eq('org_id', orgId)
          .eq('hash', hash)
          .maybeSingle()
        assets.push((raced as StudioAssetRow) ?? null)
        continue
      }
      assets.push(asset as StudioAssetRow)
    }

    return NextResponse.json({ urls, assets })
  } catch (e) {
    return apiError(e)
  }
}
