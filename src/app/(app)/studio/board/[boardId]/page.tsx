export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { StudioEditorLoader } from './StudioEditorLoader'
import {
  slideFromRow,
  assetFromRow,
  specFromRow,
  masterLayoutFromJson,
  type StudioSlideRow,
  type StudioAssetRow,
  type StudioSpecRow,
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
    .select('studio_enabled, logo_url, studio_logo_url, business_name')
    .eq('org_id', orgId)
    .maybeSingle()

  if (!settings?.studio_enabled) redirect('/dashboard')

  const { data: board } = await supabase
    .from('studio_boards')
    .select('id, name, last_state, client_id, project_id, master_layout, clients(client_name)')
    .eq('id', boardId)
    .maybeSingle()
  if (!board) notFound()

  const client = Array.isArray(board.clients) ? board.clients[0] : board.clients

  const [{ data: slideRows }, { data: assetRows }, { data: specRows }, { data: supplierRows }, { data: accessRows }] =
    await Promise.all([
      supabase
        .from('studio_slides')
        .select('id, board_id, org_id, name, heading, sort_order, objects, is_cover')
        .eq('board_id', board.id)
        .order('sort_order'),
      supabase
        .from('studio_assets')
        .select('id, board_id, org_id, url, hash, natural_width, natural_height, file_size, created_at, label')
        .eq('board_id', board.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('studio_specs')
        .select(
          'id, board_id, org_id, slide_id, object_id, spec_name, description, notes, supplier_id, supplier_name, category, quantity, unit, width, depth, height, materials, status, piece_id, item_specs'
        )
        .eq('board_id', board.id),
      supabase.from('suppliers').select('id, supplier_name, is_platform, price_list_id').order('supplier_name'),
      supabaseAdmin.from('price_list_access').select('price_list_id').eq('org_id', orgId).eq('status', 'active'),
    ])

  const slides = ((slideRows ?? []) as StudioSlideRow[]).map(slideFromRow)
  const assets = ((assetRows ?? []) as StudioAssetRow[]).map(assetFromRow)
  const specs = ((specRows ?? []) as StudioSpecRow[]).map(specFromRow)
  const suppliers = (supplierRows ?? []).map(su => ({
    id: su.id as string,
    name: su.supplier_name as string,
    isPlatform: !!su.is_platform,
    priceListId: (su.price_list_id as string | null) ?? null,
  }))
  const activePriceListIds = (accessRows ?? []).map(a => a.price_list_id as string)

  return (
    <StudioEditorLoader
      boardId={board.id}
      projectId={(board.project_id as string | null) ?? null}
      orgId={orgId}
      clientId={board.client_id}
      clientName={client?.client_name ?? ''}
      boardName={board.name}
      businessName={settings.business_name ?? ''}
      logoUrl={settings.studio_logo_url ?? settings.logo_url ?? null}
      studioLogoUrl={settings.studio_logo_url ?? null}
      orgLogoUrl={settings.logo_url ?? null}
      slides={
        slides.length
          ? slides
          : [{ id: crypto.randomUUID(), name: 'Slide 1', heading: '', sortOrder: 0, objects: [], isCover: false }]
      }
      assets={assets}
      specs={specs}
      suppliers={suppliers}
      activePriceListIds={activePriceListIds}
      masterLayout={masterLayoutFromJson(board.master_layout)}
      lastState={(board.last_state as BoardLastState | null) ?? null}
    />
  )
}
