import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const host = req.headers.get('host') ?? 'quotinghub.co.za'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  return NextResponse.redirect(`${protocol}://${host}/login`, { status: 302 })
}
