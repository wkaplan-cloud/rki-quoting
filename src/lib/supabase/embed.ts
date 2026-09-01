/**
 * Helpers for Supabase embedded (joined) rows.
 *
 * PostgREST returns a joined relation as either a single object or a
 * one-element array depending on the relationship, and the client types it as
 * both. Code across the app used to unwrap that with a hand-rolled
 * `Array.isArray(x) ? x[0] : x` behind an `as any`, which lost every other
 * bit of type information on the row at the same time.
 */

/** A joined relation as PostgREST may return it. */
export type Embedded<T> = T | T[] | null | undefined

/** Unwraps an embedded relation to the single row, or null when absent. */
export function one<T>(value: Embedded<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}
