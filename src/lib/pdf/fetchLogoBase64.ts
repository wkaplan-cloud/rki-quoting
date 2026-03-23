import { supabaseAdmin } from '@/lib/supabase/admin'

export async function fetchLogoBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    // If it's a Supabase Storage URL, extract the path and download via admin client
    // This avoids auth/CORS issues when fetching from server-side
    const storageMatch = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/)
    if (storageMatch) {
      const fullPath = storageMatch[1]! // e.g. "branding/logo.png"
      const slashIdx = fullPath.indexOf('/')
      const bucket = fullPath.slice(0, slashIdx)
      const path = fullPath.slice(slashIdx + 1).split('?')[0]!
      const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
      if (error || !data) return null
      const buffer = await data.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      return `data:${data.type || 'image/png'};base64,${base64}`
    }

    // Fallback: plain fetch for non-Supabase URLs
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = res.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}
