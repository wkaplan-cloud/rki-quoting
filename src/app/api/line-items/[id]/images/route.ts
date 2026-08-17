import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// JPEG/PNG only — react-pdf renders nothing else, and an unrenderable image
// would throw and fail the entire quote PDF. The client compresses and
// re-encodes to JPEG before posting, so this is a backstop.
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png'])
const MAX_BYTES = 5 * 1024 * 1024
const MAX_PER_ITEM = 6

/**
 * line_items has no org_id — access is granted through the parent project, so
 * every read/write here goes via the user's RLS client and fails closed if the
 * line item is not reachable from a project they can see.
 */
async function loadLineItem(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from('line_items')
    .select('id, project_id, image_urls')
    .eq('id', id)
    .single()
  return data
}

// POST /api/line-items/[id]/images — upload images, append to line_items.image_urls
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Platform feature flag — the studio must have been granted access
    const { data: settings } = await supabase
      .from('settings')
      .select('line_item_images_enabled')
      .maybeSingle()
    if (!settings?.line_item_images_enabled) {
      return NextResponse.json({ error: 'Line item images are not enabled for this studio' }, { status: 403 })
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

    for (const file of files) {
      if (!ALLOWED_IMAGE_MIME.has(file.type)) return NextResponse.json({ error: `${file.name} is not an allowed image type` }, { status: 400 })
      if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} exceeds the 5 MB limit` }, { status: 400 })
    }

    const lineItem = await loadLineItem(supabase, id)
    if (!lineItem) return NextResponse.json({ error: 'Line item not found' }, { status: 404 })

    const existing: string[] = lineItem.image_urls ?? []
    if (existing.length >= MAX_PER_ITEM) {
      return NextResponse.json({ error: `Maximum ${MAX_PER_ITEM} images per line item` }, { status: 400 })
    }

    const newUrls: string[] = []
    for (const file of files.slice(0, MAX_PER_ITEM - existing.length)) {
      const ext = file.name.split('.').pop()
      const path = `line-items/${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await supabaseAdmin.storage
        .from('sourcing-images')
        .upload(path, buffer, { contentType: file.type, upsert: false })

      if (uploadError) continue

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('sourcing-images')
        .getPublicUrl(path)

      newUrls.push(publicUrl)
    }

    if (!newUrls.length) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

    const allUrls = [...existing, ...newUrls]
    const { error: updateError } = await supabase
      .from('line_items')
      .update({ image_urls: allUrls })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ urls: newUrls, all_urls: allUrls })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/line-items/[id]/images — remove a specific image url
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url } = await req.json() as { url: string }
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    const lineItem = await loadLineItem(supabase, id)
    if (!lineItem) return NextResponse.json({ error: 'Line item not found' }, { status: 404 })

    const updated = (lineItem.image_urls ?? []).filter((u: string) => u !== url)
    const { error: updateError } = await supabase
      .from('line_items')
      .update({ image_urls: updated })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true, all_urls: updated })
  } catch (e) {
    return apiError(e)
  }
}
