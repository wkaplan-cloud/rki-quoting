import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { email?: string; email_cc?: string }
  const allowed: Record<string, string | null> = {}
  if ('email' in body) allowed.email = body.email ?? null
  if ('email_cc' in body) allowed.email_cc = body.email_cc ?? null

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('suppliers')
    .update(allowed)
    .eq('id', params.id)

  if (error) {
    console.error('Failed to update supplier:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
