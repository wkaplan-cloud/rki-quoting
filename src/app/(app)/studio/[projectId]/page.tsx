export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { StudioEditorLoader } from './StudioEditorLoader'
import { slideFromRow, type StudioSlideRow, type BoardLastState } from '@/lib/studio/types'

export default async function StudioBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
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

  const { data: project } = await supabase
    .from('projects')
    .select('id, project_name, project_number')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) notFound()

  // Get or create this project's board (one board per project in Sprint 1)
  let { data: board } = await supabase
    .from('studio_boards')
    .select('id, last_state')
    .eq('project_id', projectId)
    .maybeSingle()

  if (!board) {
    const { data: created, error } = await supabase
      .from('studio_boards')
      .insert({ org_id: orgId, project_id: projectId })
      .select('id, last_state')
      .single()
    if (error || !created) {
      // A concurrent open may have created it — re-read before giving up
      const { data: existing } = await supabase
        .from('studio_boards')
        .select('id, last_state')
        .eq('project_id', projectId)
        .maybeSingle()
      if (!existing) throw new Error(error?.message ?? 'Could not create board')
      board = existing
    } else {
      board = created
      await supabase.from('studio_slides').insert({
        board_id: created.id,
        org_id: orgId,
        name: 'Slide 1',
        sort_order: 0,
      })
    }
  }

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
      projectId={projectId}
      projectName={project.project_name}
      businessName={settings.business_name ?? ''}
      logoUrl={settings.logo_url ?? null}
      slides={slides.length ? slides : [{ id: crypto.randomUUID(), name: 'Slide 1', heading: '', sortOrder: 0, objects: [] }]}
      lastState={(board.last_state as BoardLastState | null) ?? null}
    />
  )
}
