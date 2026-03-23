import { NextRequest, NextResponse } from 'next/server'
import { SAGE_AUTH_URL } from '@/lib/sage'

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'quotinghub.co.za'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/api/sage/callback`

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SAGE_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: 'full_access',
    filter: 'apiv3.1',
  })

  return NextResponse.redirect(`${SAGE_AUTH_URL}?${params}`)
}
