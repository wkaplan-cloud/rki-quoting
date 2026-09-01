import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

/**
 * Renders one of our PDF document components to a Buffer.
 *
 * `renderToBuffer` is typed as taking `ReactElement<DocumentProps>`, but our
 * document components declare their own props, so TypeScript won't accept them
 * directly. Every route used to paper over that with `as any`, which threw away
 * checking on the props being passed in as well. The narrow cast now lives here
 * once: callers keep full type checking on their own component's props, and
 * only the element-type mismatch is asserted.
 */
export function renderPdfToBuffer(document: ReactElement): Promise<Buffer> {
  return renderToBuffer(document as ReactElement<DocumentProps>)
}
