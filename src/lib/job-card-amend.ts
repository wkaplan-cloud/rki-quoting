import { supabaseAdmin } from './supabase/admin'

/**
 * Stamps a job card as amended when it is changed after the client has already
 * been sent it, or has signed it. No-op on a card that has not gone out yet.
 *
 * Used by the routes that change what the client's copy would say — the job
 * card itself and its materials.
 */
export async function markJobCardAmended(jobCardId: string) {
  const { data: card } = await supabaseAdmin
    .from('elec_job_cards')
    .select('id, sent_at, client_signature_url')
    .eq('id', jobCardId)
    .maybeSingle()

  if (!card || (!card.sent_at && !card.client_signature_url)) return

  await supabaseAdmin
    .from('elec_job_cards')
    .update({ amended_at: new Date().toISOString() })
    .eq('id', jobCardId)
}
