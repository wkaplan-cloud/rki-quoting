import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import type { RfqStatusRequest } from '@/lib/studio/types'

// GET /api/studio/boards/[id]/rfq-status
// Who was asked to price each item on this board, and where each request got to
// — keyed by the spec's object id so the Procurement panel can line it up with
// what it already renders.
//
// Read live rather than hydrated with the board: a supplier can open their link
// or submit pricing while the designer has the board sitting open, so anything
// resolved at page load would be stale within minutes.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: orgId } = await supabase.rpc('get_current_org_id')
    if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

    // RLS already scopes rfq_requests to the caller's org. This check is so a
    // board id from another org 404s rather than returning an empty 200, which
    // would read in the panel as "nothing has been sent yet".
    const { data: board } = await supabase
      .from('studio_boards')
      .select('id')
      .eq('id', boardId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: rows } = await supabase
      .from('rfq_requests')
      .select('id, supplier_name, supplier_email, object_ids, opened_at, submitted_at, expires_at, created_at')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })

    // Newest request per supplier per item wins. Re-sending to chase someone is
    // routine, and counting each chase as another outstanding request would
    // make one quiet supplier look like three.
    const seen = new Set<string>()
    const byObject: Record<string, RfqStatusRequest[]> = {}

    for (const row of rows ?? []) {
      const email = ((row.supplier_email as string | null) ?? '').trim().toLowerCase()
      const entry: RfqStatusRequest = {
        id: row.id as string,
        supplierName: ((row.supplier_name as string | null) ?? '').trim() || email || 'Supplier',
        supplierEmail: (row.supplier_email as string | null) ?? '',
        sentAt: row.created_at as string,
        openedAt: (row.opened_at as string | null) ?? null,
        submittedAt: (row.submitted_at as string | null) ?? null,
        expiresAt: row.expires_at as string,
      }
      for (const objectId of ((row.object_ids as string[] | null) ?? [])) {
        const key = `${objectId}|${email}`
        if (seen.has(key)) continue
        seen.add(key)
        ;(byObject[objectId] ??= []).push(entry)
      }
    }

    return NextResponse.json({ byObject })
  } catch (e) {
    return apiError(e)
  }
}
