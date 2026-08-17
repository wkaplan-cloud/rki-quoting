import type { LineItem } from '../types'
import { fetchLogoBase64 } from './fetchLogoBase64'

/** Hard cap — react-pdf embeds every image in the buffer, so a 200-line quote
 *  with a photo on each row would blow both render time and file size. */
const MAX_IMAGES = 60

/**
 * The image to show for a line item: the designer's first upload, falling back
 * to the automatic catalogue image (Twinbru / price list / Studio).
 */
export function lineItemImageUrl(item: Pick<LineItem, 'image_urls' | 'fabric_image_url'>): string | null {
  return item.image_urls?.[0] ?? item.fabric_image_url ?? null
}

/**
 * Pre-fetch line item images as base64 data URIs, keyed by line item id.
 *
 * react-pdf fetches remote <Image src> URLs itself at render time and throws
 * on a 404 or a non-image content-type, which would fail the whole PDF. Doing
 * it up front means a broken image just goes missing instead.
 *
 * Returns {} when disabled, so callers can pass the result unconditionally.
 */
export async function fetchLineItemImages(
  lineItems: Pick<LineItem, 'id' | 'row_type' | 'image_urls' | 'fabric_image_url'>[],
  enabled: boolean,
): Promise<Record<string, string>> {
  if (!enabled) return {}

  const targets: { id: string; url: string }[] = []
  for (const item of lineItems) {
    if (item.row_type === 'section') continue
    const url = lineItemImageUrl(item)
    if (url) targets.push({ id: item.id, url })
    if (targets.length >= MAX_IMAGES) break
  }
  if (!targets.length) return {}

  // fetchLogoBase64 is internally cached and returns null on any failure.
  const results = await Promise.all(targets.map(t => fetchLogoBase64(t.url)))

  const map: Record<string, string> = {}
  targets.forEach((t, i) => {
    const data = results[i]
    if (data) map[t.id] = data
  })
  return map
}
