import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/sessions/[id]/item-images — upload ref images for a sourcing item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: sessionId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) return NextResponse.json({ urls: [] })

    const urls: string[] = []
    for (const file of files.slice(0, 5)) {
      const path = `item-refs/${sessionId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const bytes = await file.arrayBuffer()
      const { error } = await supabase.storage
        .from('sourcing-images')
        .upload(path, bytes, { contentType: file.type, upsert: false })
      if (!error) {
        const { data } = supabase.storage.from('sourcing-images').getPublicUrl(path)
        urls.push(data.publicUrl)
      }
    }

    return NextResponse.json({ urls })
  } catch (e) {
    return apiError(e)
  }
}
