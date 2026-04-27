import Link from 'next/link'
import { FileText, Receipt, ShoppingCart, Users, Zap, Download, Check, ArrowRight, ChevronRight, MapPin } from 'lucide-react'

interface CityConfig {
  city: string
  province: string
  slug: string
  neighborhoods: string[]
  blurb: string
  heroSubtitle: string
}

export function CityLandingPage({ config }: { config: CityConfig }) {
  const { city, province, neighborhoods, blurb, heroSubtitle } = config

  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-6 h-32 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-28 w-auto object-contain" />
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">
              Pricing
            </Link>
            <Link href="/blog" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">
              Blog
            </Link>
            <Link href="/login" className="px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">
              Log in
            </Link>
            <Link href="/signup" className="px-4 py-2 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-48 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-8">
                <MapPin size={12} className="text-[#C4A46B]" />
                <span className="text-xs font-medium text-[#9A7B4F] tracking-wide">{city}, {province}</span>
              </div>

              <h1 className="font-serif text-5xl md:text-6xl text-[#1A1A18] leading-[1.05] tracking-tight mb-4">
                Quoting software for<br />
                <em className="text-[#C4A46B] not-italic">{city} interior designers.</em>
              </h1>

              <p className="font-serif text-xl text-[#9A7B4F] italic mb-6 tracking-tight">
                {heroSubtitle}
              </p>

              <p className="text-lg text-[#8A877F] max-w-xl leading-relaxed mb-6">
                {blurb}
              </p>

              <div className="flex flex-wrap gap-2 mb-10">
                {neighborhoods.map(n => (
                  <span key={n} className="text-xs text-[#8A877F] bg-white border border-[#D8D3C8] rounded-full px-3 py-1">
                    {n}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
                >
                  Start for free <ArrowRight size={15} />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[#D8D3C8] text-[#2C2C2A] text-sm font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white"
                >
                  Log in to your studio
                </Link>
              </div>
            </div>

            <div className="flex-1 w-full lg:w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-mockup.png"
                alt={`QuotingHub — quoting software for ${city} interior designers`}
                className="w-full max-w-xl mx-auto lg:mx-0 block drop-shadow-[0_24px_60px_rgba(26,26,24,0.15)]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <div className="border-y border-[#D8D3C8] bg-white py-5 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {[
            'Real-time supplier pricing',
            'Automatic deposit calculations',
            'Instant PDF generation',
            'Purchase orders per supplier',
            'Multi-user studios',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-[#8A877F]">
              <Check size={13} className="text-[#C4A46B] flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Why QuotingHub for this city */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Built for your market</p>
            <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight">
              Why {city} studios choose QuotingHub
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: 'Real-time pricing',
                desc: `Access live supplier price lists directly in your quotes. No more calling suppliers or checking spreadsheets — pricing updates automatically.`,
              },
              {
                icon: FileText,
                title: 'Professional quotes & invoices',
                desc: 'Generate branded PDF quotes and invoices with one click. Totals, VAT, and deposits calculated automatically — ready to send to your client.',
              },
              {
                icon: ShoppingCart,
                title: 'Purchase orders',
                desc: 'Automatically split your project into per-supplier purchase orders and send them directly from the app. No more copy-pasting.',
              },
              {
                icon: Users,
                title: 'Client management',
                desc: `Keep all your ${city} clients, project history, and contact information organised in one place. Never lose track of a project again.`,
              },
              {
                icon: Receipt,
                title: 'Project pipeline',
                desc: 'Track every project from quote sent to deposit received to final delivery. See exactly where every job stands at a glance.',
              },
              {
                icon: Download,
                title: 'Team collaboration',
                desc: 'Invite designers and admins to your studio. Everyone works from the same live data — no version confusion.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group p-6 rounded-xl border border-[#EDE9E1] hover:border-[#C4A46B]/40 hover:bg-white transition-all duration-200">
                <div className="w-10 h-10 rounded-lg bg-[#9A7B4F]/10 flex items-center justify-center mb-4 group-hover:bg-[#9A7B4F]/20 transition-colors">
                  <Icon size={18} className="text-[#9A7B4F]" />
                </div>
                <h3 className="font-medium text-[#1A1A18] mb-2 text-sm">{title}</h3>
                <p className="text-sm text-[#8A877F] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-white border-y border-[#D8D3C8]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight mb-5">
            Ready to quote smarter in {city}?
          </h2>
          <p className="text-[#8A877F] text-lg mb-10">
            Join interior designers across {province} who&apos;ve replaced their spreadsheets with QuotingHub.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1A1A18] text-[#F5F2EC] font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
            >
              Create your free account <ChevronRight size={16} />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-[#D8D3C8] text-[#2C2C2A] font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white"
            >
              Learn more about QuotingHub
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D8D3C8] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-20 w-auto object-contain" />
          <p className="text-xs text-[#8A877F]">© {new Date().getFullYear()} QuotingHub · quotinghub.co.za</p>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Log in</Link>
            <Link href="/signup" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Sign up</Link>
            <Link href="/" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Home</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
