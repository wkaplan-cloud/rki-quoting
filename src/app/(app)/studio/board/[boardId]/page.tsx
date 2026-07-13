export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { StudioEditorLoader } from './StudioEditorLoader'
import {
  slideFromRow,
  assetFromRow,
  masterLayoutFromJson,
  type StudioSlideRow,
  type StudioAssetRow,
  type BoardLastState,
} from '@/lib/studio/types'

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
    .select('id, name, last_state, client_id, master_layout, clients(client_name)')
    .eq('id', boardId)
    .maybeSingle()
  if (!board) notFound()

  const client = Array.isArray(board.clients) ? board.clients[0] : board.clients

  const [{ data: slideRows }, { data: assetRows }] = await Promise.all([
    supabase
      .from('studio_slides')
      .select('id, board_id, org_id, name, heading, sort_order, objects')
      .eq('board_id', board.id)
      .order('sort_order'),
    supabase
      .from('studio_assets')
      .select('id, board_id, org_id, url, hash, natural_width, natural_height, file_size, created_at')
      .eq('board_id', board.id)
      .order('created_at', { ascending: false }),
  ])

  const slides = ((slideRows ?? []) as StudioSlideRow[]).map(slideFromRow)
  const assets = ((assetRows ?? []) as StudioAssetRow[]).map(assetFromRow)

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
      assets={assets}
      masterLayout={masterLayoutFromJson(board.master_layout)}
      lastState={(board.last_state as BoardLastState | null) ?? null}
    />
  )
}
