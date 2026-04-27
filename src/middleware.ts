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

  // Subdomain routing: suppliers.quotinghub.co.za → /supplier-portal/*
  const host = request.headers.get('host') ?? ''
  const isSupplierSubdomain = host.startsWith('suppliers.')
  const { pathname } = request.nextUrl

  if (isSupplierSubdomain) {
    // Already on a supplier-portal path — let it through
    if (pathname.startsWith('/supplier-portal') || pathname.startsWith('/sourcing/respond') || pathname.startsWith('/api/')) {
      // fall through to auth check below
    } else if (pathname === '/') {
      return NextResponse.redirect(new URL('/supplier-portal', request.url))
    } else {
      // Any other path on the subdomain → redirect to supplier portal home
      return NextResponse.redirect(new URL('/supplier-portal', request.url))
    }
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
    pathname.startsWith('/sourcing/respond') ||
    pathname.startsWith('/api/sourcing/respond') ||
    pathname.startsWith('/api/paystack/subscription-callback') ||
    pathname.startsWith('/api/paystack/webhook') ||
    pathname.startsWith('/supplier-portal/login') ||
    pathname.startsWith('/supplier-portal/register') ||
    pathname === '/supplier-portal' ||
    pathname.startsWith('/supplier-portal/privacy') ||
    pathname.startsWith('/supplier-portal/terms') ||
    pathname.startsWith('/api/supplier-portal/auth')

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    // Check if this is a supplier portal account — send them to their portal, not the main app
    const { data: supplierAccount } = await supabase
      .from('supplier_portal_accounts')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    const dest = supplierAccount ? '/supplier-portal/dashboard' : '/dashboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  if (user && pathname === '/supplier-portal/login') {
    return NextResponse.redirect(new URL('/supplier-portal/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
