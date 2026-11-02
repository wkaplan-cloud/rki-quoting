import { supabaseAdmin } from '@/lib/supabase/admin'
import { statusFromStages } from '@/lib/types'
import type { ProjectStages, ProjectStatus } from '@/lib/types'

/**
 * Writes stage fields and recomputes the project status from the full row.
 *
 * Uses the admin client — callers must already have confirmed the user can see
 * the project (an RLS read of it) before calling this.
 */
export async function applyStageUpdate(
  projectId: string,
  currentStatus: ProjectStatus,
  update: Record<string, unknown>,
): Promise<{ stages: ProjectStages | null; newStatus: ProjectStatus; error: string | null }> {
  const { error: upsertError } = await supabaseAdmin
    .from('project_stages')
    .upsert({ project_id: projectId, ...update }, { onConflict: 'project_id' })
  if (upsertError) return { stages: null, newStatus: currentStatus, error: upsertError.message }

  const { data: stages } = await supabaseAdmin
    .from('project_stages')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  let newStatus = currentStatus
  if (currentStatus !== 'Cancelled') {
    newStatus = statusFromStages(stages as ProjectStages | null)
    const { error: statusError } = await supabaseAdmin
      .from('projects')
      .update({ status: newStatus })
      .eq('id', projectId)
    if (statusError) {
      console.error('[stages] projects status update failed:', statusError.message)
      return { stages: stages as ProjectStages | null, newStatus: currentStatus, error: `Status update failed: ${statusError.message}` }
    }
  }

  return { stages: stages as ProjectStages | null, newStatus, error: null }
}
