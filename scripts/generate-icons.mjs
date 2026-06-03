import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, '../public/icons/emblem.svg')
const outDir  = resolve(__dirname, '../public/icons')

const svgBuffer = readFileSync(svgPath)

// For maskable (Android adaptive icons) the emblem must sit within
// the inner 80% safe zone — we wrap it in a padded SVG.
function maskableSvg(size) {
  const pad = Math.round(size * 0.1)
  const inner = size - pad * 2
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<image href="data:image/svg+xml;base64,${svgBuffer.toString('base64')}" ` +
    `x="${pad}" y="${pad}" width="${inner}" height="${inner}"/>` +
    `</svg>`
  )
}

const icons = [
  { file: 'favicon-32.png',           size: 32,  src: svgBuffer   },
  { file: 'apple-touch-icon-180.png', size: 180, src: svgBuffer   },
  { file: 'icon-192.png',             size: 192, src: svgBuffer   },
  { file: 'icon-512.png',             size: 512, src: maskableSvg(512) },
]

for (const { file, size, src } of icons) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(`${outDir}/${file}`)
  console.log(`✓ ${file}  (${size}×${size})`)
}

console.log('\nAll icons written to public/icons/')
