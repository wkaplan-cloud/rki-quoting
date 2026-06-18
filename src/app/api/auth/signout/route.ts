import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

function buildRedirect(req: NextRequest, fallback: string) {
  const host = req.headers.get('host') ?? 'quotinghub.co.za'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectParam = new URL(req.url).searchParams.get('redirect')
  const dest = redirectParam?.startsWith('/') ? redirectParam : fallback
  return NextResponse.redirect(`${protocol}://${host}${dest}`, { status: 302 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return buildRedirect(req, '/login')
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return buildRedirect(req, '/login')
}
