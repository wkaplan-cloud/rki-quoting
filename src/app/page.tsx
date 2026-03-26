import Link from 'next/link'
import {
  FileText, Receipt, ShoppingCart, Users, Zap, Download,
  ChevronRight, Check, ArrowRight
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-6 h-24 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-20 w-auto object-contain" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />
            <span className="text-xs font-medium text-[#9A7B4F] tracking-wide">Built for interior designers in South Africa</span>
          </div>

          <h1 className="font-serif text-5xl md:text-7xl text-[#1A1A18] leading-[1.05] tracking-tight mb-4">
            The smartest way to<br />
            <em className="text-[#C4A46B] not-italic">quote your projects.</em>
          </h1>

          <p className="font-serif text-xl md:text-2xl text-[#9A7B4F] italic mb-8 tracking-tight">
            Every project, perfectly quoted.
          </p>

          <p className="text-lg md:text-xl text-[#8A877F] max-w-2xl mx-auto leading-relaxed mb-10">
            QuotingHub replaces the other software. Create professional quotes, invoices, and purchase orders in minutes — with real-time pricing, automatic calculations, and instant PDFs.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
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

      {/* Who it's for */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Who it&apos;s for</p>
            <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight">
              Designed for the design industry
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Interior Designers */}
            <div className="bg-white border border-[#D8D3C8] rounded-2xl p-8 hover:border-[#C4A46B]/50 hover:shadow-lg transition-all duration-300">
              <div className="w-11 h-11 rounded-xl bg-[#9A7B4F]/10 flex items-center justify-center mb-5">
                <FileText size={20} className="text-[#9A7B4F]" />
              </div>
              <h3 className="font-serif text-xl text-[#1A1A18] mb-2">Interior Designers</h3>
              <p className="text-sm text-[#8A877F] leading-relaxed mb-5">
                Manage every project from first quote to final delivery. Track suppliers, items, and payments all in one place.
              </p>
              <ul className="space-y-2">
                {['Itemised quotes & invoices', 'Design fee calculations', 'Project pipeline view'].map(i => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#2C2C2A]">
                    <Check size={13} className="text-[#C4A46B] flex-shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>

            {/* Decorators */}
            <div className="bg-[#1A1A18] border border-[#1A1A18] rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#C4A46B]/10 -translate-y-1/2 translate-x-1/2" />
              <div className="w-11 h-11 rounded-xl bg-[#C4A46B]/20 flex items-center justify-center mb-5 relative z-10">
                <Users size={20} className="text-[#C4A46B]" />
              </div>
              <h3 className="font-serif text-xl text-white mb-2 relative z-10">Interior Decorators</h3>
              <p className="text-sm text-white/60 leading-relaxed mb-5 relative z-10">
                Stop losing money on inaccurate quotes. QuotingHub does the maths so you stay focused on the design.
              </p>
              <ul className="space-y-2 relative z-10">
                {['Supplier markups built in', 'Professional documents', 'Send quotes by email'].map(i => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/80">
                    <Check size={13} className="text-[#C4A46B] flex-shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>

            {/* Suppliers - Coming Soon */}
            <div className="bg-white border border-dashed border-[#D8D3C8] rounded-2xl p-8 relative">
              <div className="absolute top-4 right-4 bg-[#C4A46B]/15 text-[#9A7B4F] text-xs font-medium px-3 py-1 rounded-full">
                Coming soon
              </div>
              <div className="w-11 h-11 rounded-xl bg-[#EDE9E1] flex items-center justify-center mb-5">
                <ShoppingCart size={20} className="text-[#8A877F]" />
              </div>
              <h3 className="font-serif text-xl text-[#1A1A18] mb-2">Suppliers</h3>
              <p className="text-sm text-[#8A877F] leading-relaxed mb-5">
                Connect your product catalogue directly to QuotingHub so designers can access your latest pricing in real time.
              </p>
              <ul className="space-y-2">
                {['Live price list sync', 'Direct purchase orders', 'Order tracking'].map(i => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#8A877F]">
                    <Check size={13} className="text-[#C4BFB5] flex-shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-white border-y border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Features</p>
            <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight">
              Everything in one place
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: 'Real-time pricing',
                desc: 'Import supplier price lists and have every quote update automatically. No more manual lookups.',
              },
              {
                icon: FileText,
                title: 'Quotes & invoices',
                desc: 'Generate professional, branded PDF quotes and invoices with one click. Totals and deposits calculated automatically.',
              },
              {
                icon: ShoppingCart,
                title: 'Purchase orders',
                desc: 'Automatically split your project into per-supplier purchase orders. Send them directly from the app.',
              },
              {
                icon: Users,
                title: 'Client management',
                desc: 'Keep all your client details, project history, and contact information in one organised place.',
              },
              {
                icon: Receipt,
                title: 'Project pipeline',
                desc: 'Track every project from quote sent to deposit received to final delivery with a visual pipeline board.',
              },
              {
                icon: Download,
                title: 'Team collaboration',
                desc: 'Invite designers and admins to your studio. Everyone works from the same live data.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group p-6 rounded-xl border border-[#EDE9E1] hover:border-[#C4A46B]/40 hover:bg-[#F5F2EC] transition-all duration-200">
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
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight mb-5">
            Ready to quote smarter?
          </h2>
          <p className="text-[#8A877F] text-lg mb-10">
            Join interior designers across South Africa who&apos;ve switched from other software.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1A1A18] text-[#F5F2EC] font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
            >
              Create your free account <ChevronRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-[#D8D3C8] text-[#2C2C2A] font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D8D3C8] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-10 w-auto object-contain" />
          <p className="text-xs text-[#8A877F]">© {new Date().getFullYear()} QuotingHub · quotinghub.co.za</p>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Log in</Link>
            <Link href="/signup" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
