import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 8 * 1024 * 1024

// POST /api/studio/settings/logo — upload a dedicated, org-wide Studio logo
// (settings.studio_logo_url), used in place of the general org logo for the
// Master Page footer and new board covers whenever it's set. Fixed filename
// per org (upsert) so re-uploading just replaces it — no accumulating old
// files. Storage writes must go through supabaseAdmin: the bucket has no
// client INSERT policies.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (!ALLOWED_IMAGE_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG or WebP allowed' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Logo exceeds the 8 MB limit' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${orgId}/studio-logo/logo.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('studio-images')
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data } = supabaseAdmin.storage.from('studio-images').getPublicUrl(path)
    // Cache-bust: the public URL is otherwise identical every re-upload
    // (fixed filename), so browsers/CDNs would keep serving the old file
    const url = `${data.publicUrl}?v=${Date.now()}`

    const { error: settingsError } = await supabaseAdmin
      .from('settings')
      .update({ studio_logo_url: url })
      .eq('org_id', orgId)
    if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

    return NextResponse.json({ url })
  } catch (e) {
    return apiError(e)
  }
}

// DELETE /api/studio/settings/logo — remove the dedicated Studio logo,
// falling back to the regular org logo everywhere Studio uses it.
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    const { error } = await supabaseAdmin.from('settings').update({ studio_logo_url: null }).eq('org_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
