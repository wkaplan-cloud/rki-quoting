'use client'
import { createClient } from '@/lib/supabase/client'
import { buildCoverSlideObjects } from './coverSlide'

// Shared by every board-creation entry point (the client's board list, and
// the Studio landing page's New board flow) so the cover-slide composition
// only lives in one place. Returns the new board's id; throws on failure.
export async function createStudioBoard({
  orgId,
  clientId,
  clientName,
  boardName,
  logoUrl,
}: {
  orgId: string
  clientId: string
  clientName: string
  boardName: string
  logoUrl: string | null
}): Promise<string> {
  const supabase = createClient()
  const boardId = crypto.randomUUID()

  const { error: boardError } = await supabase
    .from('studio_boards')
    .insert({ id: boardId, org_id: orgId, client_id: clientId, name: boardName })
  if (boardError) throw new Error(boardError.message)

  const coverObjects = await buildCoverSlideObjects({
    logoUrl,
    clientName,
    projectDetail: boardName,
  })

  const { error: slidesError } = await supabase.from('studio_slides').insert([
    {
      board_id: boardId,
      org_id: orgId,
      name: 'Cover',
      heading: '',
      sort_order: 0,
      objects: coverObjects,
      is_cover: true,
    },
    {
      board_id: boardId,
      org_id: orgId,
      name: boardName,
      heading: boardName,
      sort_order: 1,
      objects: [],
      is_cover: false,
    },
  ])
  if (slidesError) throw new Error(slidesError.message)

  return boardId
}
