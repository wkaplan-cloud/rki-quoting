import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function NotASupplierPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F5F7F9' }}>
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center" style={{ border: '1px solid #E4E4E7', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#FEF3C7' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#D97706" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 className="text-lg font-semibold mb-2" style={{ color: '#18181B' }}>Wrong account type</h1>
        <p className="text-sm leading-relaxed mb-1" style={{ color: '#71717A' }}>
          You&apos;re signed in as a <strong style={{ color: '#18181B' }}>designer</strong>
          {user?.email ? <> ({user.email})</> : ''}.
        </p>
        <p className="text-sm leading-relaxed mb-8" style={{ color: '#71717A' }}>
          This link is for suppliers. Sign out and log in with your supplier portal account to continue.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="/api/auth/signout?redirect=/supplier-portal/login"
            className="w-full py-2.5 text-sm font-semibold rounded-lg"
            style={{ background: '#18181B', color: '#fff' }}
          >
            Sign out &amp; go to supplier login
          </a>
          <Link
            href="https://quotinghub.co.za/dashboard"
            className="w-full py-2.5 text-sm font-medium rounded-lg"
            style={{ background: '#F4F4F5', color: '#52525B' }}
          >
            Back to designer dashboard
          </Link>
        </div>

        <p className="text-xs mt-6" style={{ color: '#A1A1AA' }}>Powered by QuotingHub</p>
      </div>
    </div>
  )
}
