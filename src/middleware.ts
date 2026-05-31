import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const host = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // suppliers.quotinghub.co.za is retired — 301 everything to the main domain
  if (host.startsWith('suppliers.')) {
    const dest = new URL(request.url)
    dest.host = host.replace('suppliers.', '')
    return NextResponse.redirect(dest, { status: 301 })
  }

  // /requests/[id] shorthand used in sourcing emails — redirect to full supplier-portal path
  if (pathname.startsWith('/requests/')) {
    return NextResponse.redirect(new URL(`/supplier-portal${pathname}`, request.url))
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Platform admin routes — handled by their own layout auth check
  if (pathname.startsWith('/platform')) {
    return supabaseResponse
  }

  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/subscribe') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/confirming') ||
    pathname.startsWith('/set-password') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/reset') ||
    pathname.startsWith('/api/auth/set-password') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/opengraph-image' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname === '/llms.txt' ||
    pathname.startsWith('/api/contact') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/cron') ||
    pathname.endsWith('.xml') ||
    pathname.endsWith('.html') ||
    pathname.startsWith('/interior-design-software-') ||
    pathname.startsWith('/blog') ||
    pathname.startsWith('/faq') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/sourcing/respond') ||
    pathname.startsWith('/api/sourcing/respond') ||
    pathname.startsWith('/job/') ||
    pathname.startsWith('/api/job/') ||
    pathname.startsWith('/api/paystack/subscription-callback') ||
    pathname.startsWith('/api/paystack/webhook') ||
    pathname.startsWith('/api/supplier-portal/paystack/callback') ||
    pathname.startsWith('/supplier-portal/login') ||
    pathname.startsWith('/supplier-portal/register') ||
    pathname.startsWith('/supplier-portal/accept-staff-invite') ||
    pathname.startsWith('/supplier-portal/accept-admin-invite') ||
    pathname === '/supplier-portal' ||
    pathname.startsWith('/supplier-portal/not-a-supplier') ||
    pathname.startsWith('/supplier-portal/privacy') ||
    pathname.startsWith('/supplier-portal/terms') ||
    pathname.startsWith('/api/supplier-portal/auth') ||
    pathname.startsWith('/api/supplier-portal/staff/accept-invite') ||
    pathname.startsWith('/api/supplier-portal/quoting/team/accept') ||
    pathname.startsWith('/meta-callback') ||
    pathname.startsWith('/q/') ||
    pathname.startsWith('/api/q/') ||
    pathname.startsWith('/vo/') ||
    pathname.startsWith('/api/vo/') ||
    pathname.startsWith('/approve/') ||
    pathname.startsWith('/api/approve/') ||
    pathname.startsWith('/job-sign/') ||
    pathname.startsWith('/api/job-sign/')

  if (!user && !isPublic) {
    // Supplier portal routes go to supplier login, not designer login
    if (pathname.startsWith('/supplier-portal/')) {
      const loginUrl = new URL('/supplier-portal/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    // Allow signed-in non-admin users to reach /login when redirected from /platform
    // so they can sign out and sign in as the platform admin
    if (request.nextUrl.searchParams.get('from') === 'platform') {
      return supabaseResponse
    }
    // Check if this is a supplier portal account — send them to their portal, not the main app
    const { data: supplierAccount } = await supabase
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    const dest = supplierAccount ? '/supplier-portal/price-requests' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (user && pathname === '/supplier-portal/login') {
    const redirectTo = request.nextUrl.searchParams.get('redirect')
    const dest = redirectTo?.startsWith('/supplier-portal/') ? redirectTo : '/supplier-portal/price-requests'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Pass pathname to layouts via header (used for trades-supplier upgrade redirect)
  supabaseResponse.headers.set('x-pathname', pathname)
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov|avi)$).*)'],
}
