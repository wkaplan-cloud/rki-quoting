import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'

// POST /api/sourcing/respond/[token]/upload
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const { data: ss } = await supabaseAdmin
      .from('sourcing_session_suppliers')
      .select('id')
      .eq('token', token)
      .maybeSingle()

    if (!ss) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `supplier-quotes/${ss.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const bytes = await file.arrayBuffer()
    const { error: uploadError } = await supabaseAdmin.storage
      .from('sourcing-uploads')
      .upload(path, bytes, { contentType: file.type, upsert: false })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: urlData } = supabaseAdmin.storage
      .from('sourcing-uploads')
      .getPublicUrl(path)

    return NextResponse.json({ url: urlData.publicUrl, name: file.name })
  } catch (e) {
    return apiError(e)
  }
}
