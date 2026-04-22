import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 30

// Public upload endpoint for supplier response attachments.
// Validates the token is a live sourcing request before accepting the file.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // Validate token is a real, active sourcing request
  const { data: recipient } = await supabaseAdmin
    .from('sourcing_request_recipients')
    .select('id, sourcing_requests(status)')
    .eq('token', token)
    .single()

  if (!recipient) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const maxMb = 5
  if (file.size > maxMb * 1024 * 1024) {
    return NextResponse.json({ error: `File must be under ${maxMb}MB` }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `sourcing/${recipient.id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabaseAdmin.storage
    .from('sourcing-attachments')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('sourcing-attachments')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
