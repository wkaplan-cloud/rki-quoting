const MAX_MB  = 5
const QUALITY = 0.82   // JPEG compression quality — good balance of size vs clarity
const MAX_DIM = 2400   // Max px on longest side before downscaling

// Compress an image file client-side using Canvas before uploading.
// - Rejects files over MAX_MB regardless of type
// - Compresses JPEG/PNG/WebP by re-encoding to JPEG at QUALITY
// - Converts SVG to PNG (react-pdf cannot render SVG directly)
// - Returns the file unchanged for PDF and other non-image types
export async function compressImage(file: File): Promise<File> {
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`File is too large — please keep uploads under ${MAX_MB}MB`)
  }

  const raster = ['image/jpeg', 'image/png', 'image/webp']
  const isSvg  = file.type === 'image/svg+xml'

  if (!raster.includes(file.type) && !isSvg) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      // SVGs often report 0 intrinsic dimensions — default to a sensible logo size
      let width  = img.naturalWidth  || 800
      let height = img.naturalHeight || 200
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

      if (isSvg) {
        canvas.toBlob(blob => {
          if (!blob) { resolve(file); return }
          const name = file.name.replace(/\.[^.]+$/, '') + '.png'
          resolve(new File([blob], name, { type: 'image/png' }))
        }, 'image/png')
      } else {
        canvas.toBlob(
          blob => {
            if (!blob) { resolve(file); return }
            const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
            resolve(new File([blob], name, { type: 'image/jpeg' }))
          },
          'image/jpeg',
          QUALITY,
        )
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image — please try another file'))
    }

    img.src = url
  })
}
