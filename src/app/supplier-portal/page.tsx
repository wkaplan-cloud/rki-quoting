import Link from 'next/link'
import { Package, MessageSquare, List, ArrowRight } from 'lucide-react'

export default function SupplierPortalLandingPage() {
  const features = [
    {
      icon: <Package size={20} className="text-[#9A7B4F]" />,
      title: 'All your price requests in one place',
      body: 'See every pricing request sent to you by design studios, all in one dashboard. No more hunting through emails.',
    },
    {
      icon: <MessageSquare size={20} className="text-[#9A7B4F]" />,
      title: 'Message designers directly',
      body: 'Ask questions or clarify specs per request, directly within the platform. No back-and-forth emails needed.',
    },
    {
      icon: <List size={20} className="text-[#9A7B4F]" />,
      title: 'Publish your price list',
      body: 'Upload your products with pricing, lead times and images. Designers on QuotingHub can reference your catalogue.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      {/* Nav */}
      <header className="bg-[#2C2C2A]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-12 w-auto object-contain" style={{ filter: 'invert(1) brightness(0.8)' }} />
          <div className="flex items-center gap-3">
            <Link href="/supplier-portal/login" className="text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
            <Link href="/supplier-portal/register"
              className="px-4 py-2 bg-[#C4A46B] text-white text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-block px-3 py-1 bg-[#EDE9E1] border border-[#D8D3C8] rounded-full text-xs font-semibold text-[#9A7B4F] uppercase tracking-widest mb-6">
          QuotingHub Supplier Portal
        </div>
        <h1 className="text-4xl sm:text-5xl font-semibold text-[#2C2C2A] tracking-tight leading-tight mb-5">
          Respond to price requests<br />
          <span className="text-[#9A7B4F]">faster and smarter.</span>
        </h1>
        <p className="text-lg text-[#8A877F] max-w-xl mx-auto leading-relaxed mb-10">
          A free portal for suppliers to manage price requests from interior design studios on QuotingHub — without digging through email.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/supplier-portal/register"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#2C2C2A] text-white text-sm font-semibold rounded-xl hover:bg-[#9A7B4F] transition-colors"
          >
            Create free account <ArrowRight size={15} />
          </Link>
          <Link
            href="/supplier-portal/login"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white border border-[#D8D3C8] text-[#2C2C2A] text-sm font-semibold rounded-xl hover:border-[#9A7B4F] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map(f => (
            <div key={f.title} className="bg-white rounded-2xl border border-[#EDE9E1] p-7">
              <div className="w-11 h-11 rounded-xl bg-[#F5F2EC] flex items-center justify-center mb-5">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-[#2C2C2A] mb-2">{f.title}</h3>
              <p className="text-sm text-[#8A877F] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-[#2C2C2A]">
        <div className="max-w-5xl mx-auto px-6 py-14 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-lg font-semibold text-white">Ready to get started?</p>
            <p className="text-sm text-white/50 mt-0.5">It takes less than a minute to create your account.</p>
          </div>
          <Link
            href="/supplier-portal/register"
            className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-[#C4A46B] text-white text-sm font-semibold rounded-xl hover:bg-[#9A7B4F] transition-colors"
          >
            Create free account <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4">
        <p className="text-xs text-[#C4BFB5]">© QuotingHub · quotinghub.co.za</p>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-xs text-[#C4BFB5] hover:text-[#8A877F] transition-colors">Designer sign in</Link>
          <Link href="/supplier-portal/privacy" className="text-xs text-[#C4BFB5] hover:text-[#8A877F] transition-colors">Privacy</Link>
          <Link href="/supplier-portal/terms" className="text-xs text-[#C4BFB5] hover:text-[#8A877F] transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
