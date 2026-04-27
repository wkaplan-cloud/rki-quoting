import Link from 'next/link'

export default function SupplierPrivacyPage() {
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
              className="px-4 py-2 bg-[#1B4F8A] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold text-[#2C2C2A] tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#8A877F] mb-10">Supplier Portal · Last updated January 2025</p>

        <div className="space-y-8 text-[#4A4845]">
          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">1. Who we are</h2>
            <p className="text-sm leading-relaxed">
              QuotingHub is operated by Kaplan Advisory Group (Pty) Ltd, registered in South Africa. This Privacy Policy
              applies to the QuotingHub Supplier Portal available at suppliers.quotinghub.co.za. We act as the responsible
              party for personal information processed through this portal.
            </p>
            <p className="text-sm leading-relaxed mt-2">
              Contact: <a href="mailto:info@quotinghub.co.za" className="text-[#1B4F8A] hover:underline">info@quotinghub.co.za</a>
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">2. Information we collect</h2>
            <p className="text-sm leading-relaxed mb-2">When you register and use the Supplier Portal, we collect:</p>
            <ul className="space-y-1.5 text-sm leading-relaxed list-none">
              {[
                'Company name, email address, and password (account registration)',
                'Product information, pricing, and lead times you upload to your price list',
                'Messages sent between you and interior design studios',
                'Pricing responses submitted to quote requests',
                'Usage data including login times, pages visited, and actions taken',
                'IP address and device/browser information for security purposes',
              ].map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#C4A46B] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">3. How we use your information</h2>
            <ul className="space-y-1.5 text-sm leading-relaxed list-none">
              {[
                'To create and manage your Supplier Portal account',
                'To route pricing requests from design studios to your account',
                'To facilitate communication between you and design studios',
                'To calculate and process the 1% platform fee on confirmed deals',
                'To send transactional emails (price request notifications, confirmations)',
                'To improve our platform and troubleshoot issues',
                'To comply with applicable South African laws including POPIA',
              ].map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#C4A46B] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">4. Information sharing</h2>
            <p className="text-sm leading-relaxed">
              We do not sell your personal information. We share information only as follows:
            </p>
            <ul className="space-y-1.5 text-sm leading-relaxed list-none mt-2">
              {[
                'With interior design studios: your company name, email, and pricing responses are shared with studios that have sent you price requests.',
                'With service providers: we use Supabase (database and authentication), Resend (email delivery), and Paystack (payments). These providers process data on our behalf under data processing agreements.',
                'As required by law: we may disclose information if required by South African law or a valid court order.',
              ].map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#C4A46B] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">5. Data retention</h2>
            <p className="text-sm leading-relaxed">
              We retain your account data for as long as your account is active. Price request history and
              transaction records are retained for a minimum of 5 years for accounting and legal compliance purposes.
              You may request deletion of your account at any time; however, transaction records required for legal
              compliance may be retained longer.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">6. Security</h2>
            <p className="text-sm leading-relaxed">
              We implement industry-standard security measures including encrypted storage of passwords,
              HTTPS for all data in transit, and row-level security on our database. However, no method of
              transmission over the internet is 100% secure and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">7. Your rights (POPIA)</h2>
            <p className="text-sm leading-relaxed mb-2">
              Under the Protection of Personal Information Act (POPIA), you have the right to:
            </p>
            <ul className="space-y-1.5 text-sm leading-relaxed list-none">
              {[
                'Access the personal information we hold about you',
                'Request correction of inaccurate personal information',
                'Request deletion of your personal information (subject to legal retention requirements)',
                'Object to the processing of your personal information',
                'Lodge a complaint with the Information Regulator of South Africa',
              ].map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-[#C4A46B] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed mt-3">
              To exercise these rights, contact us at <a href="mailto:info@quotinghub.co.za" className="text-[#1B4F8A] hover:underline">info@quotinghub.co.za</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#2C2C2A] mb-3">8. Changes to this policy</h2>
            <p className="text-sm leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes
              by email or by displaying a notice in the Supplier Portal. Your continued use of the portal
              after changes constitutes acceptance of the updated policy.
            </p>
          </section>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4" style={{ borderTop: '1px solid #E8E4DC' }}>
        <p className="text-xs text-[#C4BFB5]">© QuotingHub · quotinghub.co.za</p>
        <div className="flex items-center gap-4">
          <Link href="/supplier-portal" className="text-xs text-[#C4BFB5] hover:text-[#8A877F] transition-colors">Supplier Portal</Link>
          <Link href="/supplier-portal/terms" className="text-xs text-[#C4BFB5] hover:text-[#8A877F] transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
