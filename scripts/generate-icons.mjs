import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../public/icons')

// QH emblem SVG — matches the existing mark:
// outer border square, Q ring with diagonal tail + teal dot, H letterform
// Cream background (#F5F2EC), dark slate marks (#3D4B5E), teal accent (#4FBCBD)
// viewBox 0 0 100 100
function makeSvg(size) {
  const sw = 2.4  // stroke width

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <rect width="100" height="100" fill="#F5F2EC"/>
  <!-- outer border square -->
  <rect x="13" y="13" width="74" height="74" rx="2" ry="2"
        fill="none" stroke="#3D4B5E" stroke-width="${sw}"/>
  <!-- Q: ring -->
  <circle cx="39" cy="44" r="17.5"
          fill="none" stroke="#3D4B5E" stroke-width="${sw}"/>
  <!-- Q: tail diagonal -->
  <line x1="52" y1="57" x2="61" y2="69"
        stroke="#3D4B5E" stroke-width="${sw}" stroke-linecap="round"/>
  <!-- Q: teal dot at tail tip -->
  <circle cx="61" cy="69" r="3.2" fill="#4FBCBD"/>
  <!-- H: left vertical -->
  <line x1="63" y1="27" x2="63" y2="62"
        stroke="#3D4B5E" stroke-width="${sw}" stroke-linecap="round"/>
  <!-- H: right vertical -->
  <line x1="79" y1="27" x2="79" y2="62"
        stroke="#3D4B5E" stroke-width="${sw}" stroke-linecap="round"/>
  <!-- H: crossbar -->
  <line x1="63" y1="44.5" x2="79" y2="44.5"
        stroke="#3D4B5E" stroke-width="${sw}" stroke-linecap="round"/>
</svg>`
}

// For maskable (Android adaptive) — emblem sits within the safe zone (inner ~80%)
// achieved by scaling down the marks and centering them
function makeMaskableSvg(size) {
  const sw = 2.4
  const scale = 0.78
  const offset = (100 - 100 * scale) / 2

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <rect width="100" height="100" fill="#F5F2EC"/>
  <g transform="translate(${offset.toFixed(2)}, ${offset.toFixed(2)}) scale(${scale})">
    <rect x="13" y="13" width="74" height="74" rx="2" ry="2"
          fill="none" stroke="#3D4B5E" stroke-width="${sw}"/>
    <circle cx="39" cy="44" r="17.5"
            fill="none" stroke="#3D4B5E" stroke-width="${sw}"/>
    <line x1="52" y1="57" x2="61" y2="69"
          stroke="#3D4B5E" stroke-width="${sw}" stroke-linecap="round"/>
    <circle cx="61" cy="69" r="3.2" fill="#4FBCBD"/>
    <line x1="63" y1="27" x2="63" y2="62"
          stroke="#3D4B5E" stroke-width="${sw}" stroke-linecap="round"/>
    <line x1="79" y1="27" x2="79" y2="62"
          stroke="#3D4B5E" stroke-width="${sw}" stroke-linecap="round"/>
    <line x1="63" y1="44.5" x2="79" y2="44.5"
          stroke="#3D4B5E" stroke-width="${sw}" stroke-linecap="round"/>
  </g>
</svg>`
}

const icons = [
  { file: 'favicon-32.png',        size: 32,  svg: makeSvg(32)           },
  { file: 'apple-touch-icon-180.png', size: 180, svg: makeSvg(180)       },
  { file: 'icon-192.png',          size: 192, svg: makeSvg(192)          },
  { file: 'icon-512.png',          size: 512, svg: makeMaskableSvg(512)  },
]

for (const { file, size, svg } of icons) {
  const outPath = `${outDir}/${file}`
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`✓ ${file}  (${size}×${size})`)
}

console.log('\nAll icons written to public/icons/')
