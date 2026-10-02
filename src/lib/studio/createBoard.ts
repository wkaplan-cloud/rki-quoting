'use client'
import { createClient } from '@/lib/supabase/client'
import { buildCoverSlideObjects } from './coverSlide'
import { createOfflineBoard, isNetworkError, offlineBoardHref } from './offlineBoards'
import type { StudioSlide } from './types'

// Shared by every board-creation entry point (the client's board list, and
// the Studio landing page's New board flow) so the cover-slide composition
// only lives in one place. Returns the new board's id and where to open it;
// throws on failure.
//
// With no connection the board is created on the device instead (see
// offlineBoards.ts) and opened in the offline editor page — it reaches the
// server, under the same id, the next time the device is online.
export async function createStudioBoard({
  orgId,
  clientId,
  clientName,
  boardName,
  logoUrl,
  createdBy,
  createdByName,
}: {
  orgId: string
  clientId: string
  clientName: string
  boardName: string
  logoUrl: string | null
  createdBy: string
  createdByName: string | null
}): Promise<{ boardId: string; href: string; offline: boolean }> {
  const boardId = crypto.randomUUID()

  // Composed up front so the online and offline paths start from the very
  // same slides. The logo loads from the image cache when there is no signal,
  // and the cover simply goes without it if it was never cached.
  const coverObjects = await buildCoverSlideObjects({
    logoUrl,
    clientName,
    projectDetail: boardName,
  })
  const slides: StudioSlide[] = [
    { id: crypto.randomUUID(), name: 'Cover', heading: '', sortOrder: 0, objects: coverObjects, isCover: true },
    { id: crypto.randomUUID(), name: boardName, heading: boardName, sortOrder: 1, objects: [], isCover: false },
  ]

  const goOffline = async () => {
    await createOfflineBoard({
      id: boardId,
      orgId,
      clientId,
      clientName,
      boardName,
      createdBy,
      createdByName,
      initialSlides: slides,
    })
    return { boardId, href: offlineBoardHref(boardId), offline: true }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) return goOffline()

  const supabase = createClient()

  const { error: boardError } = await supabase.from('studio_boards').insert({
    id: boardId,
    org_id: orgId,
    client_id: clientId,
    name: boardName,
    // Stamped once, here, and never rewritten — a board is filed under a
    // client at this moment and this is the only record of who filed it
    created_by: createdBy,
    created_by_name: createdByName,
  })
  if (boardError) {
    if (isNetworkError(boardError.message)) return goOffline()
    throw new Error(boardError.message)
  }

  const { error: slidesError } = await supabase.from('studio_slides').insert(
    slides.map(sl => ({
      id: sl.id,
      board_id: boardId,
      org_id: orgId,
      name: sl.name,
      heading: sl.heading,
      sort_order: sl.sortOrder,
      objects: sl.objects,
      is_cover: sl.isCover,
    }))
  )
  if (slidesError) {
    // The board row landed but the signal dropped before the slides did —
    // finish on the device; the sync treats the existing row as done
    if (isNetworkError(slidesError.message)) return goOffline()
    throw new Error(slidesError.message)
  }

  return { boardId, href: `/studio/board/${boardId}`, offline: false }
}
