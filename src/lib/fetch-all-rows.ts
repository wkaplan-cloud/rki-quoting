// PostgREST caps every response at 1000 rows and reports no error when it
// truncates — the caller just gets a short array that looks complete.
//
// That is survivable when a query is ordered newest-first and only the newest
// rows matter. It is a data bug the moment something walks a window forwards:
// the read then returns the *oldest* page and hides everything recent. The
// auto-clockout cron did exactly that, closing shifts that had ended weeks
// earlier while never seeing the ones still open. Anything that needs a whole
// range rather than a top slice must page through it.

export const PAGE_SIZE = 1000

export interface PagedResult<T> {
  data: T[] | null
  error: { message: string } | null
}

/**
 * Reads every row a range query matches, one page at a time.
 *
 * `page(from, to)` must apply an inclusive `.range(from, to)` to an otherwise
 * fixed query — same filters and same total ordering on every call, or rows
 * will be skipped or repeated across page boundaries. Order by a tiebreaker
 * (a primary key) alongside the sort column so the ordering is total.
 *
 * @param maxPages Safety stop, so an unstable ordering cannot loop forever.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PagedResult<T>>,
  maxPages = 100,
): Promise<{ rows: T[]; error: string | null; truncated: boolean }> {
  const rows: T[] = []

  for (let i = 0; i < maxPages; i++) {
    const from = i * PAGE_SIZE
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) return { rows, error: error.message, truncated: true }
    rows.push(...(data ?? []))
    // A short page is the last page.
    if (!data || data.length < PAGE_SIZE) return { rows, error: null, truncated: false }
  }

  return { rows, error: null, truncated: true }
}
