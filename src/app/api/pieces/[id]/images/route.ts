import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// POST /api/pieces/[id]/images — upload images, append to piece.image_urls
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 })

    // Fetch existing image_urls
    const { data: piece } = await supabase
      .from('pieces')
      .select('image_urls, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!piece) return NextResponse.json({ error: 'Piece not found' }, { status: 404 })

    const existing: string[] = piece.image_urls ?? []
    const newUrls: string[] = []

    for (const file of files.slice(0, 10 - existing.length)) {
      const ext = file.name.split('.').pop()
      const path = `pieces/${user.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
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

    const allUrls = [...existing, ...newUrls]

    await supabase
      .from('pieces')
      .update({ image_urls: allUrls, updated_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ urls: newUrls, all_urls: allUrls })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/pieces/[id]/images — remove a specific image url
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url } = await req.json() as { url: string }

    const { data: piece } = await supabase
      .from('pieces')
      .select('image_urls')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!piece) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = (piece.image_urls ?? []).filter((u: string) => u !== url)
    await supabase.from('pieces').update({ image_urls: updated }).eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
