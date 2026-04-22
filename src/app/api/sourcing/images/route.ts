import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST /api/sourcing/images — upload an image and attach it to a sourcing request
// Body: multipart/form-data with fields: file, sourcing_request_id, caption (optional)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const sourcingRequestId = formData.get('sourcing_request_id') as string | null
  const caption = (formData.get('caption') as string | null)?.trim() || null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!sourcingRequestId) return NextResponse.json({ error: 'sourcing_request_id required' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })

  // Verify ownership
  const { data: request } = await supabase
    .from('sourcing_requests')
    .select('status')
    .eq('id', sourcingRequestId)
    .single()

  if (!request) return NextResponse.json({ error: 'Sourcing request not found' }, { status: 404 })
  if (request.status !== 'draft') {
    return NextResponse.json({ error: 'Images can only be added to draft requests' }, { status: 400 })
  }

  // Determine sort order
  const { count } = await supabase
    .from('sourcing_request_images')
    .select('id', { count: 'exact', head: true })
    .eq('sourcing_request_id', sourcingRequestId)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `${sourcingRequestId}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabaseAdmin.storage
    .from('sourcing-images')
    .upload(filename, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('sourcing-images')
    .getPublicUrl(filename)

  const { data, error } = await supabase
    .from('sourcing_request_images')
    .insert({
      sourcing_request_id: sourcingRequestId,
      url: publicUrl,
      caption,
      sort_order: count ?? 0,
      file_size_bytes: file.size,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}

// DELETE /api/sourcing/images?image_id=xxx — remove an image
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const imageId = req.nextUrl.searchParams.get('image_id')
  if (!imageId) return NextResponse.json({ error: 'image_id required' }, { status: 400 })

  // Verify ownership via RLS (the policy checks user_id via sourcing_requests)
  const { data: image } = await supabase
    .from('sourcing_request_images')
    .select('url')
    .eq('id', imageId)
    .single()

  if (!image) return NextResponse.json({ error: 'Image not found' }, { status: 404 })

  // Extract storage path from URL
  const url = new URL(image.url)
  const pathParts = url.pathname.split('/sourcing-images/')
  if (pathParts[1]) {
    await supabaseAdmin.storage.from('sourcing-images').remove([pathParts[1]])
  }

  await supabase.from('sourcing_request_images').delete().eq('id', imageId)

  return NextResponse.json({ success: true })
}
