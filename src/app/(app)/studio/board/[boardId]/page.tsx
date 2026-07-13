export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { StudioEditorLoader } from './StudioEditorLoader'
import { slideFromRow, type StudioSlideRow, type BoardLastState } from '@/lib/studio/types'

export default async function StudioBoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgId } = await supabase.rpc('get_current_org_id')
  if (!orgId) redirect('/dashboard')

  const { data: settings } = await supabaseAdmin
    .from('settings')
    .select('studio_enabled, logo_url, business_name')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!settings?.studio_enabled) redirect('/dashboard')

  const { data: board } = await supabase
    .from('studio_boards')
    .select('id, name, last_state, client_id, clients(client_name)')
    .eq('id', boardId)
    .maybeSingle()
  if (!board) notFound()

  const client = Array.isArray(board.clients) ? board.clients[0] : board.clients

  const { data: slideRows } = await supabase
    .from('studio_slides')
    .select('id, board_id, org_id, name, heading, sort_order, objects')
    .eq('board_id', board.id)
    .order('sort_order')

  const slides = ((slideRows ?? []) as StudioSlideRow[]).map(slideFromRow)

  return (
    <StudioEditorLoader
      boardId={board.id}
      orgId={orgId}
      clientId={board.client_id}
      clientName={client?.client_name ?? ''}
      boardName={board.name}
      businessName={settings.business_name ?? ''}
      logoUrl={settings.logo_url ?? null}
      slides={slides.length ? slides : [{ id: crypto.randomUUID(), name: 'Slide 1', heading: '', sortOrder: 0, objects: [] }]}
      lastState={(board.last_state as BoardLastState | null) ?? null}
    />
  )
}
