import { supabaseAdmin } from '@/lib/supabase/admin'

const cache = new Map<string, { data: string | null; expiresAt: number }>()
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

export async function fetchLogoBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null

  // react-pdf cannot render SVG — skip silently
  if (url.includes('.svg') || url.includes('svg+xml')) return null

  const cached = cache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.data
  try {
    // If it's a Supabase Storage URL, extract the path and download via admin client
    const storageMatch = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/)
    if (storageMatch) {
      const fullPath = storageMatch[1]! // e.g. "branding/logo.png"
      const slashIdx = fullPath.indexOf('/')
      const bucket = fullPath.slice(0, slashIdx)
      const path = fullPath.slice(slashIdx + 1).split('?')[0]!
      const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
      if (error) {
        console.error('[fetchLogoBase64] admin download error:', error.message, '| bucket:', bucket, '| path:', path)
      }
      if (!error && data) {
        const buffer = await data.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        // Use Blob type if it's a valid image type, otherwise derive from path
        const mime = (data.type && data.type.startsWith('image/') && !data.type.includes('svg'))
          ? data.type
          : mimeFromPath(path)
        const result = `data:${mime};base64,${base64}`
        cache.set(url, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
        return result
      }
      // Admin download failed — fall through to plain fetch
    }

    // Plain fetch fallback (non-Supabase URLs, or admin download failed)
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[fetchLogoBase64] plain fetch failed:', res.status, url)
      return null
    }
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = res.headers.get('content-type') || 'image/png'
    if (contentType.includes('svg')) return null
    const result = `data:${contentType.split(';')[0]};base64,${base64}`
    cache.set(url, { data: result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  } catch (e) {
    console.error('[fetchLogoBase64] unexpected error:', e)
    return null
  }
}
