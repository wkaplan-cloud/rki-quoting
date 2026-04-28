import Link from 'next/link'

export default function SupplierTermsPage() {
  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      {/* Nav */}
      <header className="bg-[#2C2C2A]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="QuotingHub" className="h-10 w-auto object-contain" style={{ filter: 'invert(1) brightness(0.8)' }} />
          <div className="flex items-center gap-3">
            <Link href="/supplier-portal/login" className="text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
            <Link href="/supplier-portal/register"
              className="px-4 py-2 bg-[#34495E] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold text-[#2C2C2A] tracking-tight mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-[#8A877F] mb-10">Supplier Portal · Last updated January 2025</p>

        <div className="space-y-8 text-[#4A4845]">
          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">1. Acceptance of terms</h2>
            <p className="text-sm leading-relaxed">
              By registering for or using the QuotingHub Supplier Portal (&quot;Portal&quot;), you agree to be bound by
              these Terms &amp; Conditions. If you do not agree, you may not use the Portal. These terms apply
              to all suppliers who access the Portal at suppliers.quotinghub.co.za.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">2. The service</h2>
            <p className="text-sm leading-relaxed">
              QuotingHub provides a digital platform that connects interior design studios with furniture and
              decor suppliers. The Supplier Portal allows registered suppliers to receive and respond to
              pricing requests, manage a digital price list, and communicate with design studios.
              The Portal is provided free of charge to register and use, subject to the platform fee
              described in clause 5.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">3. Registration and account</h2>
            <ul className="space-y-1.5 text-sm leading-relaxed list-none">
              {[
                'You must register using an email address that design studios use when sending you price requests.',
                'You are responsible for maintaining the confidentiality of your login credentials.',
                'You must provide accurate company information during registration and keep it up to date.',
                'You may not share your account with other individuals or companies.',
                'We reserve the right to suspend or terminate accounts that violate these terms.',
              ].map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#C4A46B] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">4. Your responsibilities</h2>
            <ul className="space-y-1.5 text-sm leading-relaxed list-none">
              {[
                'Respond to price requests accurately and in good faith.',
                'Ensure that prices, lead times, and product information you submit are correct.',
                'Honour prices and lead times that have been accepted by a design studio through the platform.',
                'Not use the Portal for any unlawful purpose or in a way that violates any applicable law.',
                'Not attempt to circumvent the platform fee by moving confirmed deals off-platform.',
              ].map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#C4A46B] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">5. Platform fee</h2>
            <div className="bg-white rounded-xl p-5 border border-[#EDE9E1] text-sm leading-relaxed space-y-2">
              <p>
                A platform fee of <strong className="text-[#2C2C2A]">1% of the confirmed deal value (excluding VAT)</strong> is
                charged to the supplier for each order confirmed through QuotingHub.
              </p>
              <p>A deal is considered &quot;confirmed&quot; when a design studio accepts a price submitted by you via the Portal.</p>
              <p>The fee is invoiced to the supplier and is payable within 30 days of invoice date.</p>
              <p>
                QuotingHub reserves the right to update the platform fee with 30 days&apos; written notice.
                Continued use of the platform after notice constitutes acceptance of the new fee.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">6. Intellectual property</h2>
            <p className="text-sm leading-relaxed">
              You retain ownership of all product data, pricing, and images you upload to the Portal. By uploading
              content, you grant QuotingHub a non-exclusive, royalty-free licence to display that content to
              interior design studios using the platform. You represent that you own or have the right to use
              all content you upload.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">7. Disclaimers and limitation of liability</h2>
            <p className="text-sm leading-relaxed">
              The Portal is provided &quot;as is&quot; without warranty of any kind. QuotingHub does not guarantee
              the accuracy of information submitted by design studios, nor does it guarantee that you will
              receive a minimum number of price requests. To the maximum extent permitted by South African law,
              QuotingHub&apos;s total liability to you for any claim arising from your use of the Portal shall not
              exceed the platform fees paid by you in the 12 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">8. Termination</h2>
            <p className="text-sm leading-relaxed">
              You may close your account at any time by contacting us at{' '}
              <a href="mailto:info@quotinghub.co.za" className="text-[#34495E] hover:underline">info@quotinghub.co.za</a>.
              Outstanding platform fees remain due and payable upon termination. We may terminate or suspend
              your account immediately if you breach these terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">9. Governing law</h2>
            <p className="text-sm leading-relaxed">
              These terms are governed by the laws of the Republic of South Africa. Any disputes shall be
              subject to the exclusive jurisdiction of the South African courts.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">10. Contact</h2>
            <p className="text-sm leading-relaxed">
              Questions about these terms?{' '}
              <a href="mailto:info@quotinghub.co.za" className="text-[#34495E] hover:underline">info@quotinghub.co.za</a>
              {' '}· quotinghub.co.za
            </p>
          </section>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4" style={{ borderTop: '1px solid #E8E4DC' }}>
        <p className="text-xs text-[#C4BFB5]">© QuotingHub · quotinghub.co.za</p>
        <div className="flex items-center gap-4">
          <Link href="/supplier-portal" className="text-xs text-[#C4BFB5] hover:text-[#8A877F] transition-colors">Supplier Portal</Link>
          <Link href="/supplier-portal/privacy" className="text-xs text-[#C4BFB5] hover:text-[#8A877F] transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
