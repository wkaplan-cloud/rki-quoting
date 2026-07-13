import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { buildStudioPackage } from '@/lib/studio/package'
import {
  slideFromRow,
  assetFromRow,
  specFromRow,
  masterLayoutFromJson,
  type StudioSlideRow,
  type StudioAssetRow,
  type StudioSpecRow,
} from '@/lib/studio/types'

// GET /api/studio/boards/[id]/package — the board as one complete package
// (slides + objects + assets + master layout). Foundation for duplication,
// export, backup and sharing; already usable as a JSON backup download.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: boardId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RLS client scopes every read to the caller's org
    const { data: board } = await supabase
      .from('studio_boards')
      .select('id, name, client_id, project_id, master_layout')
      .eq('id', boardId)
      .maybeSingle()
    if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [{ data: slides }, { data: assets }, { data: specs }] = await Promise.all([
      supabase
        .from('studio_slides')
        .select('id, board_id, org_id, name, heading, sort_order, objects')
        .eq('board_id', boardId)
        .order('sort_order'),
      supabase
        .from('studio_assets')
        .select('id, board_id, org_id, url, hash, natural_width, natural_height, file_size, created_at')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false }),
      supabase
        .from('studio_specs')
        .select(
          'id, board_id, org_id, slide_id, object_id, spec_name, description, notes, supplier_id, supplier_name, category, quantity, unit, width, depth, height, materials, status'
        )
        .eq('board_id', boardId),
    ])

    const pkg = buildStudioPackage({
      board: {
        id: board.id,
        name: board.name,
        clientId: board.client_id,
        projectId: board.project_id ?? null,
        masterLayout: masterLayoutFromJson(board.master_layout),
      },
      slides: ((slides ?? []) as StudioSlideRow[]).map(slideFromRow),
      assets: ((assets ?? []) as StudioAssetRow[]).map(assetFromRow),
      specs: ((specs ?? []) as StudioSpecRow[]).map(specFromRow),
    })

    return new NextResponse(JSON.stringify(pkg, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${board.name.replace(/[^a-zA-Z0-9 _-]/g, '')}.studioboard.json"`,
      },
    })
  } catch (e) {
    return apiError(e)
  }
}
