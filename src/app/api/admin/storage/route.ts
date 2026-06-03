import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// GET /api/admin/storage — total upload storage bytes for the current org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) return NextResponse.json({ totalBytes: 0, fileCount: 0 })

  // ── 1. Sourcing item images ──────────────────────────────────────────────
  // Walk: sourcing_sessions (org-scoped via RLS) → sourcing_session_items → sourcing_item_images
  const { data: sessions } = await supabase
    .from('sourcing_sessions')
    .select('id')

  const sessionIds = (sessions ?? []).map(s => s.id)

  let sourcingBytes = 0
  let sourcingCount = 0

  if (sessionIds.length > 0) {
    const { data: sessionItems } = await supabase
      .from('sourcing_session_items')
      .select('id')
      .in('session_id', sessionIds)

    const itemIds = (sessionItems ?? []).map(i => i.id)

    if (itemIds.length > 0) {
      const { data: images } = await supabaseAdmin
        .from('sourcing_item_images')
        .select('file_size_bytes')
        .in('item_id', itemIds)

      sourcingBytes = (images ?? []).reduce((sum, r) => sum + (r.file_size_bytes ?? 0), 0)
      sourcingCount = (images ?? []).length
    }
  }

  // ── 2. Piece images ──────────────────────────────────────────────────────
  // pieces.image_urls is a text[] — count non-empty entries as files
  // We don't store file_size_bytes for pieces, so we estimate 200 KB each
  const { data: pieces } = await supabase
    .from('pieces')
    .select('image_urls')

  const pieceImageCount = (pieces ?? []).reduce((n, p) => n + ((p.image_urls as string[] | null)?.length ?? 0), 0)
  const pieceBytes = pieceImageCount * 200 * 1024 // ~200 KB estimate per piece image
  const pieceCount = pieceImageCount

  // ── 3. Capital pieces images ─────────────────────────────────────────────
  const { data: capitalPieces } = await supabaseAdmin
    .from('capital_pieces')
    .select('image_url')
    .eq('org_id', orgId)
    .not('image_url', 'is', null)

  const capitalPieceCount = (capitalPieces ?? []).length
  const capitalPieceBytes = capitalPieceCount * 200 * 1024

  // ── 4. Capital request item images ───────────────────────────────────────
  const { data: capitalItems } = await supabaseAdmin
    .from('capital_request_items')
    .select('image_url')
    .eq('org_id', orgId)
    .not('image_url', 'is', null)

  const capitalItemCount = (capitalItems ?? []).length
  const capitalItemBytes = capitalItemCount * 400 * 1024 // phone photos ~400 KB after compression

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalBytes = sourcingBytes + pieceBytes + capitalPieceBytes + capitalItemBytes
  const fileCount = sourcingCount + pieceCount + capitalPieceCount + capitalItemCount

  return NextResponse.json({ totalBytes, fileCount })
}
