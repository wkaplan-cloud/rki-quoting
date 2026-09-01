// Shared PostgREST select strings for elec_jobs.
//
// job_card_id is added by supabase/add_job_card_to_elec_jobs.sql. Until that
// migration is run the column (and therefore the embedded relationship) does
// not exist, so every read falls back to the pre-migration shape rather than
// breaking the schedule page.

export const JOB_SELECT_FULL =
  '*, staff:elec_staff(id,name,color,role), quote:elec_quotes(id,quote_number,project_name), job_card:elec_job_cards(id,job_number,title)'

export const JOB_SELECT_LEGACY =
  '*, staff:elec_staff(id,name,color,role), quote:elec_quotes(id,quote_number,project_name)'

export const JOB_SELECT_FULL_WITH_PHOTOS  = `${JOB_SELECT_FULL}, elec_job_photos(count)`
export const JOB_SELECT_LEGACY_WITH_PHOTOS = `${JOB_SELECT_LEGACY}, elec_job_photos(count)`

/** True when the error is "job_card_id / the elec_job_cards embed doesn't exist yet". */
export function isMissingJobCardLink(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // 42703 = undefined column, PGRST200 = no such embedded relationship
  return error.code === '42703' || error.code === 'PGRST200' || (error.message ?? '').includes('job_card')
}
