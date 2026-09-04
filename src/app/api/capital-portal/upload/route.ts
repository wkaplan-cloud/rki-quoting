import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { rateLimit } from '@/lib/rate-limit'

const MAX_BYTES = 15 * 1024 * 1024 // 15 MB

// Sniff the real file type from magic bytes so a spoofed `file.type` header
// (which the client fully controls) can't smuggle a non-image through.
function sniffExt(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  // HEIC/HEIF: ISO-BMFF 'ftyp' box with a heic/heif/mif1 brand.
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12)
    if (['heic', 'heix', 'heif', 'mif1', 'msf1'].includes(brand)) return 'heic'
  }
  return null
}

// POST /api/capital-portal/upload — public, uploads a hotel request image
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 'capital-upload', 30, 60 * 60 * 1000)
    if (limited) return limited

    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image too large (max 15 MB)' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = sniffExt(buffer)
    if (!ext) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP or HEIC images are allowed' }, { status: 400 })
    }
    const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'heic' ? 'image/heic' : `image/${ext}`

    const path = `requests/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('capital-hotel-images')
      .upload(path, buffer, { contentType, upsert: false })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('capital-hotel-images')
      .getPublicUrl(path)

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    return apiError(e)
  }
}
