import Link from 'next/link'
import { Package, MessageSquare, List, ArrowRight, CheckCircle, Bolt, Droplets, Factory } from 'lucide-react'

export default function SupplierPortalLandingPage() {
  const features = [
    {
      icon: <Package size={20} style={{ color: '#3A7CA5' }} />,
      title: 'All your price requests in one place',
      body: 'See every pricing request sent to you by design studios, all in one dashboard. No more hunting through emails.',
    },
    {
      icon: <MessageSquare size={20} style={{ color: '#3A7CA5' }} />,
      title: 'Message designers directly',
      body: 'Ask questions or clarify specs per request, directly within the platform. No back-and-forth emails needed.',
    },
    {
      icon: <List size={20} style={{ color: '#3A7CA5' }} />,
      title: 'Publish your price list',
      body: 'Upload your products with pricing, lead times and images. Designers on QuotingHub can reference your catalogue.',
    },
  ]

  const bullets = [
    'Free to join — no credit card required',
    'Respond to requests in minutes, not days',
    'Works alongside your existing workflow',
  ]

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FA' }}>
      {/* Nav */}
      <header style={{ background: '#1E2A38', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-5xl mx-auto px-6 h-20 sm:h-32 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-16 sm:h-28 w-auto max-w-[160px] sm:max-w-[220px] object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.85 }} />
          <div className="flex items-center gap-3">
            <Link
              href="/supplier-portal/login"
              className="text-sm font-medium transition-colors text-slate-400 hover:text-slate-200"
            >
              Sign in
            </Link>
            <Link
              href="/supplier-portal/register"
              className="px-4 py-2 text-sm font-semibold rounded-lg transition-opacity"
              style={{ background: '#3A7CA5', color: '#FFFFFF' }}
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: '#1E2A38' }}>
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: 'rgba(58,124,165,0.15)', color: '#3A7CA5', border: '1px solid rgba(58,124,165,0.25)' }}
          >
            QuotingHub Supplier Portal
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-5" style={{ color: '#E2E8F0' }}>
            Respond to price requests<br />
            <span style={{ color: '#3A7CA5' }}>faster and smarter.</span>
          </h1>
          <p className="text-lg max-w-xl mx-auto leading-relaxed mb-10" style={{ color: '#94A3B8' }}>
            A free portal for suppliers to manage price requests from interior design studios on QuotingHub — without digging through email.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/supplier-portal/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-xl transition-opacity"
              style={{ background: '#3A7CA5', color: '#FFFFFF' }}
            >
              Create free account <ArrowRight size={15} />
            </Link>
            <Link
              href="/supplier-portal/login"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold rounded-xl transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#E2E8F0', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Sign in
            </Link>
          </div>

          {/* Bullets */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8">
            {bullets.map(b => (
              <span key={b} className="flex items-center gap-1.5 text-sm" style={{ color: '#64748B' }}>
                <CheckCircle size={13} style={{ color: '#3A7CA5' }} />
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map(f => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-7"
              style={{ border: '1px solid #E4E4E7', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(58,124,165,0.08)' }}
              >
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#18181B' }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#71717A' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#18181B' }}>Choose your module</h2>
          <p className="text-sm max-w-lg mx-auto leading-relaxed" style={{ color: '#71717A' }}>
            QuotingHub is expanding beyond interior design. Pick the module built for your trade.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Electrician — live */}
          <div className="bg-white rounded-2xl p-7 relative" style={{ border: '2px solid #3A7CA5', boxShadow: '0 4px 20px rgba(58,124,165,0.12)' }}>
            <span className="absolute top-5 right-5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'rgba(34,197,94,0.1)', color: '#16A34A' }}>
              Live
            </span>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(58,124,165,0.08)' }}>
              <Bolt size={20} style={{ color: '#3A7CA5' }} />
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: '#18181B' }}>Electrician</h3>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: '#71717A' }}>
              A complete quoting and billing system — quotes, progress claims, variation orders, COC tracker, snag lists and monthly RECON.
            </p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-2xl font-bold" style={{ color: '#18181B' }}>R1,999</span>
              <span className="text-xs" style={{ color: '#71717A' }}>/month excl. VAT</span>
            </div>
            <Link
              href="/supplier-portal/register"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity"
              style={{ color: '#3A7CA5' }}
            >
              Get started <ArrowRight size={13} />
            </Link>
          </div>

          {/* Plumber — coming soon */}
          <div className="bg-white rounded-2xl p-7 relative opacity-70" style={{ border: '1px solid #E4E4E7', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <span className="absolute top-5 right-5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'rgba(234,179,8,0.1)', color: '#CA8A04' }}>
              Coming soon
            </span>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(58,124,165,0.06)' }}>
              <Droplets size={20} style={{ color: '#94A3B8' }} />
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: '#18181B' }}>Plumber</h3>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: '#71717A' }}>
              The same powerful quoting and billing module — tailored for plumbing contractors. Progress claims, COC and more.
            </p>
            <p className="text-sm font-medium" style={{ color: '#A1A1AA' }}>In development</p>
          </div>

          {/* Manufacturer — coming soon */}
          <div className="bg-white rounded-2xl p-7 relative opacity-70" style={{ border: '1px solid #E4E4E7', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <span className="absolute top-5 right-5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'rgba(234,179,8,0.1)', color: '#CA8A04' }}>
              Coming soon
            </span>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(58,124,165,0.06)' }}>
              <Factory size={20} style={{ color: '#94A3B8' }} />
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: '#18181B' }}>Manufacturer</h3>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: '#71717A' }}>
              Connect directly with interior design studios on QuotingHub. Receive price requests, respond to specs, and publish your catalogue — with a simple 1% commission on confirmed orders placed through the platform.
            </p>
            <p className="text-sm font-medium" style={{ color: '#A1A1AA' }}>In development</p>
          </div>

        </div>
      </section>

      {/* CTA strip */}
      <section style={{ background: '#1E2A38', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="max-w-5xl mx-auto px-6 py-14 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-lg font-semibold" style={{ color: '#E2E8F0' }}>Ready to get started?</p>
            <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>It takes less than a minute to create your account.</p>
          </div>
          <Link
            href="/supplier-portal/register"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-opacity"
            style={{ background: '#3A7CA5', color: '#FFFFFF' }}
          >
            Create free account <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4">
        <p className="text-xs" style={{ color: '#A1A1AA' }}>© QuotingHub · quotinghub.co.za</p>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs transition-colors" style={{ color: '#A1A1AA' }}>Designer sign in</Link>
          <Link href="/supplier-portal/privacy" className="text-xs transition-colors" style={{ color: '#A1A1AA' }}>Privacy</Link>
          <Link href="/supplier-portal/terms" className="text-xs transition-colors" style={{ color: '#A1A1AA' }}>Terms</Link>
        </div>
      </footer>
    </div>
  )
}
