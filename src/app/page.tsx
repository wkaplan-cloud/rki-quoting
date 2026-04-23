import Link from 'next/link'
import {
  FileText, Receipt, ShoppingCart, Users, Zap, Download,
  ChevronRight, Check, ArrowRight, Mail
} from 'lucide-react'
import { ContactForm } from './ContactForm'
import { AuthRecoveryRedirect } from './_components/AuthRecoveryRedirect'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">
      <AuthRecoveryRedirect />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 sm:h-32 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-16 sm:h-28 w-auto max-w-[160px] sm:max-w-[220px] object-contain" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/pricing" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Pricing</Link>
            <Link href="/faq" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">FAQ</Link>
            <Link href="/login" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href="/signup" className="px-3 py-2 sm:px-4 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Start for free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 sm:pt-48 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Text side */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />
                <span className="text-xs font-medium text-[#9A7B4F] tracking-wide">Built for interior designers in South Africa</span>
              </div>

              <h1 className="font-serif text-5xl md:text-6xl text-[#1A1A18] leading-[1.05] tracking-tight mb-4">
                Win more projects.<br />
                <em className="text-[#C4A46B] not-italic">Run a better studio.</em>
              </h1>

              <p className="font-serif text-xl text-[#9A7B4F] italic mb-6 tracking-tight">
                Quote faster. Look more professional. Close deals with confidence.
              </p>

              <p className="text-lg text-[#8A877F] max-w-xl leading-relaxed mb-10">
                QuotingHub is the business system interior designers use to quote professionally, reduce admin, and grow their revenue — designed for the way designers actually work.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
                >
                  Start quoting professionally <ArrowRight size={15} />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[#D8D3C8] text-[#2C2C2A] text-sm font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white"
                >
                  Log in to your studio
                </Link>
              </div>
            </div>

            {/* Mockup side */}
            <div className="flex-1 w-full lg:w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-mockup.png"
                alt="QuotingHub dashboard"
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
            'Quote faster, close deals sooner',
            'Professional branded documents',
            'Less admin, more design time',
            'Purchase orders per supplier',
            'Built to grow with your studio',
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
              Designed for the way designers actually work
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Interior Designers */}
            <div className="rounded-2xl overflow-hidden border border-[#D8D3C8] hover:border-[#C4A46B]/50 hover:shadow-lg transition-all duration-300 relative">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/who-designers.jpg)' }} />
              <div className="absolute inset-0 bg-[#F5F2EC]/88" />
              <div className="relative p-8">
              <div className="w-11 h-11 rounded-xl bg-[#9A7B4F]/10 flex items-center justify-center mb-5">
                <FileText size={20} className="text-[#9A7B4F]" />
              </div>
              <h3 className="font-serif text-xl text-[#1A1A18] mb-2">Interior Designers</h3>
              <p className="text-sm text-[#8A877F] leading-relaxed mb-5">
                Move clients forward faster. Send polished, professional quotes that build trust and win projects — without the admin overhead.
              </p>
              <ul className="space-y-2">
                {['Win more projects with professional quotes', 'Design fee calculations built in', 'Track every project from quote to delivery'].map(i => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#2C2C2A]">
                    <Check size={13} className="text-[#C4A46B] flex-shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
              </div>
            </div>

            {/* Decorators */}
            <div className="rounded-2xl overflow-hidden border border-[#1A1A18] relative">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/who-decorators.jpg)' }} />
              <div className="absolute inset-0 bg-[#1A1A18]/82" />
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#C4A46B]/10 -translate-y-1/2 translate-x-1/2" />
              <div className="relative p-8">
              <div className="w-11 h-11 rounded-xl bg-[#C4A46B]/20 flex items-center justify-center mb-5 relative z-10">
                <Users size={20} className="text-[#C4A46B]" />
              </div>
              <h3 className="font-serif text-xl text-white mb-2 relative z-10">Interior Decorators</h3>
              <p className="text-sm text-white/60 leading-relaxed mb-5 relative z-10">
                Stop losing time and money on manual quoting. QuotingHub handles the numbers so you can focus on the work that actually grows your business.
              </p>
              <ul className="space-y-2 relative z-10">
                {['Supplier markups calculated automatically', 'Client-ready documents in minutes', 'Less back-and-forth, faster decisions'].map(i => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/80">
                    <Check size={13} className="text-[#C4A46B] flex-shrink-0" />
                    {i}
                  </li>
                ))}
              </ul>
              </div>
            </div>

            {/* Suppliers - Coming Soon */}
            <div className="rounded-2xl overflow-hidden border border-dashed border-[#D8D3C8] relative">
              <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: 'url(/who-suppliers.jpg)' }} />
              <div className="absolute inset-0 bg-[#F5F2EC]/80" />
              <div className="relative p-8">
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
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-white border-y border-[#D8D3C8] relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'url(/feature-texture.png)' }} />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">How it works for you</p>
            <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight">
              Less admin. More revenue.
            </h2>
            <p className="text-[#8A877F] text-lg mt-4 max-w-xl mx-auto leading-relaxed">
              Every part of QuotingHub is built to help you quote faster, look more professional, and run a smoother business.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: 'Quote faster, close sooner',
                desc: 'Import supplier price lists once — every quote updates automatically. Spend minutes on quotes, not hours.',
              },
              {
                icon: FileText,
                title: 'Look more professional, instantly',
                desc: 'Send branded, itemised PDFs that impress clients and reflect the quality of your work. Totals and deposits calculated automatically.',
              },
              {
                icon: ShoppingCart,
                title: 'Streamline supplier orders',
                desc: 'Auto-generate per-supplier purchase orders directly from your project. Send them in one click — no manual splitting.',
              },
              {
                icon: Users,
                title: 'Keep every client organised',
                desc: 'All your client details, project history, and communications in one place. Nothing falls through the cracks.',
              },
              {
                icon: Receipt,
                title: 'See your full pipeline at a glance',
                desc: 'Track every project from quote sent to deposit received to final delivery. Know exactly where every deal stands.',
              },
              {
                icon: Download,
                title: 'Collaborate across your team',
                desc: 'Invite your team to work from the same live data. Everyone stays aligned — no version confusion, no duplicated effort.',
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

      {/* Price Requests feature callout */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-[#1A1A18] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#C4A46B]/8 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="relative p-10 md:p-16 flex flex-col md:flex-row items-start md:items-center gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-[#C4A46B]/15 border border-[#C4A46B]/25 rounded-full px-4 py-1.5 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />
                  <span className="text-xs font-medium text-[#C4A46B] tracking-wide uppercase">Included on all plans</span>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl text-white leading-tight tracking-tight mb-4">
                  Stop chasing suppliers<br />by email.
                </h2>
                <p className="text-white/60 text-lg leading-relaxed mb-6 max-w-lg">
                  Price Requests lets you select the items you need priced, attach an image and description, and send the request directly to your suppliers — all from inside QuotingHub. No more email chains. No more chasing. Just faster sourcing and faster quotes.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'Select items and send pricing requests in seconds',
                    'Suppliers respond directly — no email thread to manage',
                    'Speed up sourcing and get quotes out faster',
                    'Available on every QuotingHub plan',
                  ].map(i => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/75">
                      <Check size={14} className="text-[#C4A46B] flex-shrink-0 mt-0.5" />
                      {i}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#9A7B4F] text-white text-sm font-medium rounded-lg hover:bg-[#B8956A] transition-colors"
                >
                  See pricing <ArrowRight size={14} />
                </Link>
              </div>
              <div className="hidden md:flex flex-col items-center justify-center w-48 flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-[#C4A46B]/15 flex items-center justify-center mb-4">
                  <Mail size={36} className="text-[#C4A46B]" />
                </div>
                <p className="text-white/30 text-xs text-center leading-relaxed">Included on every plan</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why not Excel / generic tools */}
      <section className="py-16 px-6 bg-white border-y border-[#D8D3C8]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Why QuotingHub</p>
          <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight mb-6">
            Not just a tool. A system built for your industry.
          </h2>
          <p className="text-[#8A877F] text-lg leading-relaxed max-w-2xl mx-auto mb-12">
            Excel and generic software weren&apos;t designed for interior designers. QuotingHub is built around the way design projects actually work — from supplier markups to design fees, purchase orders to client presentations.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            {[
              { label: 'vs Excel', desc: 'No more manual calculations, broken formulas, or unstyled documents. QuotingHub handles the maths and produces professional PDFs automatically.' },
              { label: 'vs Generic quoting tools', desc: 'Most quoting tools are built for tradespeople or services businesses. QuotingHub understands supplier price lists, markups, and design fees from the ground up.' },
              { label: 'vs Doing it manually', desc: 'Every hour spent on admin is an hour not spent on design or client relationships. QuotingHub gives that time back.' },
            ].map(({ label, desc }) => (
              <div key={label} className="p-6 rounded-xl border border-[#EDE9E1]">
                <p className="text-xs font-semibold text-[#9A7B4F] uppercase tracking-widest mb-3">{label}</p>
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
            Your studio deserves a better system.
          </h2>
          <p className="text-[#8A877F] text-lg mb-10">
            Join interior designers across South Africa quoting professionally and winning more projects with QuotingHub.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1A1A18] text-[#F5F2EC] font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors"
            >
              Start quoting professionally <ChevronRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-[#D8D3C8] text-[#2C2C2A] font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white"
            >
              View pricing
            </Link>
          </div>
          <p className="text-sm text-[#C4BFB5] mt-5">30-day free trial · No credit card required</p>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 sm:scroll-mt-32 py-24 px-6 bg-white border-t border-[#D8D3C8]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Get in touch</p>
            <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight mb-4">
              We&apos;d love to hear from you
            </h2>
            <p className="text-[#8A877F]">Questions, feedback, or just want to learn more — send us a message.</p>
          </div>
          <ContactForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D8D3C8] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-20 w-auto object-contain" />
          <p className="text-xs text-[#8A877F]">© {new Date().getFullYear()} QuotingHub · quotinghub.co.za</p>
          <div className="flex items-center gap-5">
            <Link href="/faq" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">FAQ</Link>
            <Link href="/terms" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Terms</Link>
            <Link href="/privacy" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
