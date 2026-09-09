import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Per-org switches for which sections a contractor uses.
 *
 * They live on elec_settings, and a contractor who has never opened their
 * settings page has no row at all — so every flag defaults to on, both when the
 * row is missing and when a column has not been migrated yet. Off is always a
 * deliberate choice someone made, never an accident of missing data.
 */
export interface OrgFeatures {
  /** Long-term quoted work: projects, claims, variation orders. */
  projects: boolean
  /** Technicians can log extra work found on site. */
  jobCardExtras: boolean
  /** Job cards may be emailed to the client, not just the office. */
  clientSend: boolean
}

export const ALL_FEATURES_ON: OrgFeatures = { projects: true, jobCardExtras: true, clientSend: true }

export async function getOrgFeatures(portalAccountId: string): Promise<OrgFeatures> {
  const { data, error } = await supabaseAdmin
    .from('elec_settings')
    .select('projects_enabled, job_card_extras_enabled, job_card_client_send_enabled')
    .eq('portal_account_id', portalAccountId)
    .maybeSingle()

  if (error || !data) return ALL_FEATURES_ON
  const row = data as Record<string, boolean | null>
  return {
    projects:      row.projects_enabled !== false,
    jobCardExtras: row.job_card_extras_enabled !== false,
    clientSend:    row.job_card_client_send_enabled !== false,
  }
}
