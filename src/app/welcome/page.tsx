import Link from 'next/link'

export default function WelcomePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundImage: 'url(/login-bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="w-full max-w-md text-center">
        <div
          className="bg-white rounded-3xl px-10 py-12"
          style={{ boxShadow: '0 40px 120px rgba(0,0,0,0.22), 0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.08)' }}
        >
          {/* Check mark */}
          <div className="w-16 h-16 rounded-full bg-[#9A7B4F]/10 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-[#9A7B4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-10 w-auto object-contain mx-auto mb-6" />

          <h1 className="font-serif text-3xl text-[#1A1A18] tracking-tight mb-3">
            Email confirmed!
          </h1>
          <p className="text-[#8A877F] text-sm leading-relaxed mb-2">
            Thank you for confirming your email address.
          </p>
          <p className="text-[#8A877F] text-sm leading-relaxed mb-10">
            You&apos;re ready to set up your studio. It only takes a couple of minutes — you&apos;ll add your business details so your quotes and invoices look professional from day one.
          </p>

          <Link
            href="/onboarding"
            className="block w-full py-3.5 bg-[#1A1A18] text-white text-sm font-medium rounded-xl hover:bg-[#9A7B4F] transition-colors duration-200"
          >
            Continue to set up my studio →
          </Link>

          <p className="text-xs text-[#C4BFB5] mt-6 leading-relaxed">
            Quotes · Invoices · Purchase Orders<br />
            Built for interior designers
          </p>
        </div>
      </div>
    </div>
  )
}
