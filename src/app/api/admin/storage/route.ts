import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Sum file sizes from a flat storage listing (one level — files only, not dirs)
async function listBytes(bucket: string, prefix: string): Promise<{ bytes: number; count: number }> {
  const { data } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 })
  let bytes = 0, count = 0
  for (const f of data ?? []) {
    if (f.id) { // id is null for folders
      bytes += (f.metadata as Record<string, number> | null)?.size ?? 0
      count++
    }
  }
  return { bytes, count }
}

// GET /api/admin/storage — actual storage usage for the current org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return NextResponse.json({ totalBytes: 0, fileCount: 0 })

  let totalBytes = 0
  let fileCount = 0

  // ── 1. Sourcing item-ref images: item-refs/{sessionId}/ ──────────────────
  // Use RLS-scoped client so we only get sessions belonging to this org
  const { data: sessions } = await supabase
    .from('sourcing_sessions')
    .select('id')

  for (const s of sessions ?? []) {
    const { bytes, count } = await listBytes('sourcing-images', `item-refs/${s.id}`)
    totalBytes += bytes
    fileCount += count
  }

  // ── 2. Piece images: pieces/{userId}/{pieceId}/ ──────────────────────────
  const { data: members } = await supabaseAdmin
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('status', 'active')

  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean) as string[]

  for (const userId of userIds) {
    const { data: pieceDirs } = await supabaseAdmin.storage
      .from('sourcing-images')
      .list(`pieces/${userId}`, { limit: 1000 })

    for (const dir of pieceDirs ?? []) {
      if (!dir.id) { // folder (piece ID)
        const { bytes, count } = await listBytes('sourcing-images', `pieces/${userId}/${dir.name}`)
        totalBytes += bytes
        fileCount += count
      }
    }
  }

  // ── 3. Capital hotel images (only for orgs with capital hotels enabled) ──
  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('capital_hotels_enabled')
    .eq('org_id', orgId)
    .maybeSingle()

  if (settings?.capital_hotels_enabled) {
    // Capital piece images: pieces/{pieceId}/
    const { data: capPieceDirs } = await supabaseAdmin.storage
      .from('capital-hotel-images')
      .list('pieces', { limit: 1000 })

    for (const dir of capPieceDirs ?? []) {
      if (!dir.id) {
        const { bytes, count } = await listBytes('capital-hotel-images', `pieces/${dir.name}`)
        totalBytes += bytes
        fileCount += count
      }
    }

    // Capital request images: requests/
    const { bytes, count } = await listBytes('capital-hotel-images', 'requests')
    totalBytes += bytes
    fileCount += count
  }

  return NextResponse.json({ totalBytes, fileCount })
}
