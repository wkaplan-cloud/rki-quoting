import type { LineItem } from '../types'
import { fetchLogoBase64 } from './fetchLogoBase64'
import { MAX_DOCUMENT_IMAGES, lineItemImageUrl } from '../lineItemImage'

export { lineItemImageUrl }

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
    if (targets.length >= MAX_DOCUMENT_IMAGES) break
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
