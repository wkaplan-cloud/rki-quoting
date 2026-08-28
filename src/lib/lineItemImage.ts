import type { LineItem } from './types'

/** Hard cap — react-pdf embeds every image in the buffer, so a 200-line quote
 *  with a photo on each row would blow both render time and file size.
 *  Lives here rather than in lib/pdf so client code can warn before sending. */
export const MAX_DOCUMENT_IMAGES = 60

/**
 * The image to show for a line item: the designer's first upload, falling back
 * to the automatic catalogue image (Twinbru / price list / Studio).
 */
export function lineItemImageUrl(item: Pick<LineItem, 'image_urls' | 'fabric_image_url'>): string | null {
  return item.image_urls?.[0] ?? item.fabric_image_url ?? null
}

/** How many rows would carry a thumbnail if this project were printed. */
export function countDocumentImages(
  items: Pick<LineItem, 'row_type' | 'image_urls' | 'fabric_image_url'>[],
): number {
  return items.reduce((n, item) => (
    item.row_type !== 'section' && lineItemImageUrl(item) ? n + 1 : n
  ), 0)
}
