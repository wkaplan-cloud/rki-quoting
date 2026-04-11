import Link from 'next/link'
import { PublicLayout } from '@/components/layout/PublicLayout'

export const metadata = { title: 'Terms of Service – QuotingHub' }

export default function TermsPage() {
  const updated = '10 April 2026'
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 pb-24">
        <h1 className="font-serif text-4xl text-[#1A1A18] tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-[#8A877F] mb-12">Last updated: {updated}</p>

        <div className="prose prose-sm max-w-none text-[#2C2C2A] space-y-8">

          <Section title="1. Agreement to Terms">
            <p>By accessing or using QuotingHub (&ldquo;the Service&rdquo;), operated by QuotingHub (Pty) Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not use the Service.</p>
            <p>These Terms constitute a legally binding agreement between you and QuotingHub (Pty) Ltd, a company registered in South Africa.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>QuotingHub is a cloud-based software-as-a-service (SaaS) platform designed for interior designers and related professionals. The Service enables users to create quotes, invoices, purchase orders, manage clients and suppliers, and generate professional PDF documents.</p>
          </Section>

          <Section title="3. Account Registration">
            <p>To use the Service, you must register for an account. You agree to:</p>
            <ul>
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>Notify us immediately of any unauthorised use of your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
            <p>You must be at least 18 years old and have the legal capacity to enter into a binding contract to use the Service.</p>
          </Section>

          <Section title="4. Subscription and Payment">
            <p><strong>4.1 Trial Period.</strong> New accounts may be offered a free trial period. No payment is required during the trial. At the end of the trial, continued use requires a paid subscription.</p>
            <p><strong>4.2 Subscription Fees.</strong> Subscription fees are charged in South African Rand (ZAR) and billed monthly or annually as selected. All fees are exclusive of VAT, which will be added where applicable.</p>
            <p><strong>4.3 Payment.</strong> Payments are processed securely. By providing payment details, you authorise us to charge your payment method for all fees due.</p>
            <p><strong>4.4 Cancellation.</strong> You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. No refunds are provided for partial periods unless required by law.</p>
            <p><strong>4.5 Price Changes.</strong> We reserve the right to change subscription pricing. We will provide at least 30 days&apos; notice before any price change takes effect. Continued use after the effective date constitutes acceptance of the new pricing.</p>
            <p><strong>4.6 Failure to Pay.</strong> If payment fails, we may suspend your account until payment is resolved. Accounts suspended for more than 60 days may be terminated.</p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws</li>
              <li>Attempt to gain unauthorised access to any part of the Service or its related systems</li>
              <li>Transmit any malicious code, viruses, or harmful software</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
              <li>Resell, sublicense, or commercially exploit the Service without our written consent</li>
              <li>Use the Service to store or transmit content that is defamatory, obscene, or infringes third-party rights</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
            </ul>
          </Section>

          <Section title="6. Data and Privacy">
            <p>Your use of the Service is subject to our <Link href="/privacy" className="text-[#9A7B4F] hover:underline">Privacy Policy</Link>, which is incorporated into these Terms by reference. By using the Service, you consent to the collection and use of your data as described in the Privacy Policy.</p>
            <p><strong>6.1 Your Data.</strong> You retain ownership of all data you upload to or create within the Service (&ldquo;Your Data&rdquo;). You grant us a limited licence to store, process, and display Your Data solely to provide the Service to you.</p>
            <p><strong>6.2 Data Accuracy.</strong> You are solely responsible for the accuracy, quality, and legality of Your Data and the means by which you acquired it.</p>
            <p><strong>6.3 Data Retention.</strong> Upon cancellation, your data will be retained for 24 months before permanent deletion. You may request earlier deletion by contacting us. Upon a verified deletion request under POPIA, we will delete your personal data within 30 days.</p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>The Service, including all software, design, text, graphics, logos, and other content, is owned by QuotingHub (Pty) Ltd and is protected by South African and international intellectual property laws.</p>
            <p>We grant you a limited, non-exclusive, non-transferable, revocable licence to use the Service solely for your internal business purposes in accordance with these Terms.</p>
          </Section>

          <Section title="8. Confidentiality">
            <p>Each party agrees to keep confidential any non-public information received from the other party that is designated as confidential or that reasonably should be understood to be confidential. This obligation does not apply to information that is publicly available, independently developed, or required to be disclosed by law.</p>
          </Section>

          <Section title="9. Disclaimers and Limitation of Liability">
            <p><strong>9.1 As Is.</strong> The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
            <p><strong>9.2 Uptime.</strong> We aim for high availability but do not guarantee uninterrupted access to the Service. Scheduled maintenance and events beyond our control may cause downtime.</p>
            <p><strong>9.3 Limitation.</strong> To the maximum extent permitted by applicable law, our total liability to you for any claim arising from or related to these Terms or the Service shall not exceed the total subscription fees paid by you in the 12 months preceding the claim.</p>
            <p><strong>9.4 Exclusion.</strong> We shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, even if advised of the possibility of such damages.</p>
          </Section>

          <Section title="10. Indemnification">
            <p>You agree to indemnify, defend, and hold harmless QuotingHub (Pty) Ltd and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to your use of the Service, your violation of these Terms, or your violation of any third-party rights.</p>
          </Section>

          <Section title="11. Termination">
            <p><strong>11.1 By You.</strong> You may terminate your account at any time by cancelling your subscription through the platform or by contacting us.</p>
            <p><strong>11.2 By Us.</strong> We may suspend or terminate your account immediately if you breach these Terms, fail to pay, or if we are required to do so by law. We will provide reasonable notice where possible.</p>
            <p><strong>11.3 Effect of Termination.</strong> Upon termination, your right to access the Service ceases. Provisions that by their nature should survive termination (including IP rights, disclaimers, and limitation of liability) shall survive.</p>
          </Section>

          <Section title="12. Governing Law and Disputes">
            <p>These Terms are governed by the laws of the Republic of South Africa. Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction of the courts of South Africa.</p>
            <p>Before commencing legal proceedings, you agree to first attempt to resolve the dispute informally by <Link href="/#contact" className="text-[#9A7B4F] hover:underline">contacting us</Link> and allowing 30 days for resolution.</p>
          </Section>

          <Section title="13. Changes to These Terms">
            <p>We may update these Terms from time to time. We will notify you of material changes by email or by displaying a prominent notice within the Service at least 14 days before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Terms.</p>
          </Section>

          <Section title="14. Contact">
            <p>For questions about these Terms, please <Link href="/#contact" className="text-[#9A7B4F] hover:underline">contact us via our website</Link>.</p>
          </Section>

        </div>

      </div>
    </PublicLayout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-[#1A1A18] mb-3 mt-8">{title}</h2>
      <div className="space-y-3 text-sm text-[#4A4A47] leading-relaxed">{children}</div>
    </div>
  )
}
