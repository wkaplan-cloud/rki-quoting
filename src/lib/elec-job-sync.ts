// Keeps a scheduled calendar job (elec_jobs) and the job card it is booked
// against (elec_job_cards) telling the same story.
//
// Division of ownership:
//   • elec_jobs owns WHEN — the calendar slot is the single source of truth for
//     timing, and elec_job_cards.scheduled_at mirrors it.
//   • elec_job_cards owns PROGRESS — the tech drives the card's status from
//     their phone, and the calendar booking mirrors it back for the owner.

import { supabaseAdmin } from '@/lib/supabase/admin'
import { todaySA } from '@/lib/dates'

/**
 * Builds a timestamptz literal from a date + time entered in South African
 * local time. SAST is a fixed UTC+2 with no DST, so the offset is a constant —
 * without it Postgres reads the naive string as UTC and the stored time drifts
 * two hours (which can roll the date over for evening bookings).
 */
export function saTimestamp(date: string, time: string): string {
  return `${date}T${time.slice(0, 5)}:00+02:00`
}

/** Normalises a naive `datetime-local` value ("2026-09-03T08:00") to SAST. */
export function normaliseSAScheduledAt(value: unknown): unknown {
  if (typeof value !== 'string' || value === '') return value
  // Already carries a zone (…Z or …±HH:MM) — leave it alone.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) return value
  const [date, time] = value.split('T')
  if (!date || !time) return value
  return saTimestamp(date, time)
}

/** Mirrors a calendar booking's slot onto the job card it is booked against. */
export async function syncJobCardScheduledAt(
  jobCardId: string | null | undefined,
  accountId: string,
  scheduledDate: string | null | undefined,
  startTime: string | null | undefined,
): Promise<void> {
  if (!jobCardId || !scheduledDate || !startTime) return
  await supabaseAdmin
    .from('elec_job_cards')
    .update({ scheduled_at: saTimestamp(scheduledDate, startTime) })
    .eq('id', jobCardId)
    .eq('portal_account_id', accountId)
}

const CARD_STATUS_TO_JOB_STATUS: Record<string, string> = {
  in_progress: 'in_progress',
  completed:   'completed',
  cancelled:   'cancelled',
}

/**
 * Mirrors a job card's progress onto the calendar bookings made against it, so
 * the owner's schedule doesn't still read "scheduled" for work already done.
 *
 * Deliberately conservative:
 *  • only bookings still open (scheduled / in_progress) are touched, so a
 *    booking someone cancelled by hand is never resurrected or overwritten;
 *  • only bookings up to today are touched — a slot still booked for next week
 *    is a second visit the owner should cancel deliberately, not silently.
 */
export async function syncJobsFromCardStatus(
  jobCardId: string,
  accountId: string,
  cardStatus: unknown,
): Promise<void> {
  if (typeof cardStatus !== 'string') return
  const jobStatus = CARD_STATUS_TO_JOB_STATUS[cardStatus]
  if (!jobStatus) return

  await supabaseAdmin
    .from('elec_jobs')
    .update({ status: jobStatus })
    .eq('job_card_id', jobCardId)
    .eq('portal_account_id', accountId)
    .lte('scheduled_date', todaySA())
    .in('status', ['scheduled', 'in_progress'])
}
