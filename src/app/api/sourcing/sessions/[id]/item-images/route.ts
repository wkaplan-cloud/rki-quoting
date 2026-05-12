import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const MAX_BYTES = 10 * 1024 * 1024

// POST /api/sourcing/sessions/[id]/item-images — upload ref images for a sourcing item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Security: verify session belongs to this org before storage upload.
    // supabaseAdmin bypasses RLS, so without this check any authenticated user
    // could write files into any org's session storage path.
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { data: session } = await supabase
      .from('sourcing_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ urls: [] })

    for (const file of files) {
      if (!ALLOWED_IMAGE_MIME.has(file.type)) return NextResponse.json({ error: `${file.name} is not an allowed image type` }, { status: 400 })
      if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} exceeds the 10 MB limit` }, { status: 400 })
    }

    const urls: string[] = []
    for (const file of files.slice(0, 5)) {
      const path = `item-refs/${sessionId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const bytes = await file.arrayBuffer()
      const { error } = await supabaseAdmin.storage
        .from('sourcing-images')
        .upload(path, bytes, { contentType: file.type, upsert: false })
      if (!error) {
        const { data } = supabaseAdmin.storage.from('sourcing-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    }

    return NextResponse.json({ urls })
  } catch (e) {
    return apiError(e)
  }
}
