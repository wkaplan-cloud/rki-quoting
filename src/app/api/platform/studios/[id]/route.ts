import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// DELETE /api/platform/studios/[id] — archives an organisation (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!orgId) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', orgId)

  if (error) {
    console.error('Failed to archive studio:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// POST /api/platform/studios/[id] — restores an archived organisation
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email?.toLowerCase() !== process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!orgId) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ status: 'active', archived_at: null })
    .eq('id', orgId)

  if (error) {
    console.error('Failed to restore studio:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
