const MAX_MB  = 5
const QUALITY = 0.82   // JPEG compression quality — good balance of size vs clarity
const MAX_DIM = 2400   // Max px on longest side before downscaling

// Compress an image file client-side using Canvas before uploading.
// - Rejects files over MAX_MB regardless of type
// - Compresses JPEG/PNG/WebP by re-encoding to JPEG at QUALITY
// - Returns the file unchanged for SVG, PDF, and other non-raster types
export async function compressImage(file: File): Promise<File> {
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`File is too large — please keep uploads under ${MAX_MB}MB`)
  }

  const compressible = ['image/jpeg', 'image/png', 'image/webp']
  if (!compressible.includes(file.type)) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width  = Math.round(width  * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return }
          // Keep original filename but force .jpg extension for compressed output
          const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
          resolve(new File([blob], name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        QUALITY,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image — please try another file'))
    }

    img.src = url
  })
}
