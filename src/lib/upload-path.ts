/**
 * Builds a unique storage object path for a user upload.
 *
 * Lives at module scope on purpose: the timestamp has to be read when the
 * upload actually happens, not when the component rendered, and keeping it out
 * of the component body means it isn't mistaken for an impure render read.
 */
export function uniqueUploadPath(folder: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : ''
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return ext ? `${folder}/${stamp}.${ext}` : `${folder}/${stamp}`
}

/** Same, but keeps the original filename after the unique stamp. */
export function uniqueUploadPathNamed(folder: string, fileName: string): string {
  return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`
}
