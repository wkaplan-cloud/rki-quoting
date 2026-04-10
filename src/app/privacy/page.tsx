import Link from 'next/link'
import { PublicLayout } from '@/components/layout/PublicLayout'

export const metadata = { title: 'Privacy Policy – QuotingHub' }

export default function PrivacyPage() {
  const updated = '10 April 2026'
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 pb-24">
        <p className="text-xs text-[#9A7B4F] uppercase tracking-widest font-semibold mb-3">Legal</p>
        <h1 className="font-serif text-4xl text-[#1A1A18] tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#8A877F] mb-12">Last updated: {updated}</p>

        <div className="space-y-8 text-sm text-[#4A4A47] leading-relaxed">

          <Section title="1. Who We Are">
            <p>QuotingHub is operated by QuotingHub (Pty) Ltd, registered in South Africa. We are the responsible party (as defined under the Protection of Personal Information Act 4 of 2013, &ldquo;POPIA&rdquo;) for the personal information we collect through our platform at quotinghub.co.za.</p>
            <p><Link href="/#contact" className="text-[#9A7B4F] hover:underline">Contact us via our website</Link></p>
          </Section>

          <Section title="2. What Personal Information We Collect">
            <p><strong>Account Information:</strong> Full name, email address, password (hashed), and business name provided at registration.</p>
            <p><strong>Business Data:</strong> Client names and contact details, supplier details, project names and numbers, quote and invoice content, and any other information you enter into the platform.</p>
            <p><strong>Payment Information:</strong> Billing details (processed securely by our payment provider — we do not store full card numbers).</p>
            <p><strong>Usage Data:</strong> IP address, browser type, pages visited, and actions taken within the platform for security and performance purposes.</p>
            <p><strong>Communications:</strong> Any emails or messages you send to our support team.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <p>We use your personal information to:</p>
            <ul>
              <li>Provide, maintain, and improve the Service</li>
              <li>Process payments and manage your subscription</li>
              <li>Send transactional emails (account confirmation, invoices, password resets)</li>
              <li>Provide customer support</li>
              <li>Detect and prevent fraud, abuse, or security breaches</li>
              <li>Comply with our legal obligations under South African law</li>
            </ul>
            <p>We do not sell your personal information to third parties. We do not use your data for advertising purposes.</p>
          </Section>

          <Section title="4. Legal Basis for Processing (POPIA)">
            <p>We process your personal information on the following grounds:</p>
            <ul>
              <li><strong>Contract:</strong> Processing necessary to perform the Service you signed up for</li>
              <li><strong>Legitimate interests:</strong> Security monitoring, fraud prevention, and platform improvement</li>
              <li><strong>Legal obligation:</strong> Compliance with South African law, including POPIA and tax legislation</li>
              <li><strong>Consent:</strong> Where you have specifically opted in (e.g. marketing communications)</li>
            </ul>
          </Section>

          <Section title="5. Data Sharing">
            <p>We share your information only with:</p>
            <ul>
              <li><strong>Supabase:</strong> Our database and authentication provider (data hosted in secure cloud infrastructure)</li>
              <li><strong>Resend:</strong> Our transactional email provider, used only to send emails you trigger (e.g. sending a quote to a client)</li>
              <li><strong>Payment processor:</strong> For billing and subscription management</li>
              <li><strong>Legal authorities:</strong> Where required by South African law or a valid court order</li>
            </ul>
            <p>All third-party processors are bound by appropriate data processing agreements and are required to protect your information.</p>
          </Section>

          <Section title="6. Data Storage and Security">
            <p>Your data is stored on secure, encrypted servers. We implement industry-standard security measures including:</p>
            <ul>
              <li>Encryption in transit (HTTPS/TLS) and at rest</li>
              <li>Row-level security ensuring your data is isolated from other organisations</li>
              <li>Multi-factor authentication options for your account</li>
              <li>Regular security reviews</li>
            </ul>
            <p>While we take all reasonable precautions, no system is 100% secure. In the event of a data breach that poses a risk to your rights and freedoms, we will notify you and the Information Regulator as required by POPIA within 72 hours of becoming aware of the breach.</p>
          </Section>

          <Section title="7. Data Retention">
            <p>We retain your personal information for as long as your account is active or as needed to provide the Service.</p>
            <ul>
              <li><strong>Active accounts:</strong> Data retained for the duration of your subscription</li>
              <li><strong>Cancelled accounts:</strong> Data retained for 24 months after cancellation, then permanently deleted</li>
              <li><strong>Deletion requests:</strong> Upon a verified request under POPIA, personal data deleted within 30 days</li>
              <li><strong>Financial records:</strong> Retained for 5 years as required by South African tax law</li>
            </ul>
          </Section>

          <Section title="8. Your Rights Under POPIA">
            <p>As a data subject under POPIA, you have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or outdated information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal retention obligations)</li>
              <li><strong>Objection:</strong> Object to the processing of your information in certain circumstances</li>
              <li><strong>Complaint:</strong> Lodge a complaint with the Information Regulator of South Africa</li>
            </ul>
            <p>To exercise any of these rights, <Link href="/#contact" className="text-[#9A7B4F] hover:underline">contact us via our website</Link>. We will respond within 30 days.</p>
            <p>The Information Regulator of South Africa can be reached at: <a href="https://www.justice.gov.za/inforeg/" target="_blank" rel="noopener noreferrer" className="text-[#9A7B4F] hover:underline">www.justice.gov.za/inforeg</a></p>
          </Section>

          <Section title="9. Cookies">
            <p>We use essential cookies required for the Service to function (authentication sessions). We do not use advertising or tracking cookies. You can disable cookies in your browser settings, but this will prevent you from logging in.</p>
          </Section>

          <Section title="10. Children">
            <p>The Service is not directed to individuals under 18 years of age. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete it.</p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes by email or by a prominent notice within the platform. Your continued use of the Service after the effective date constitutes acceptance of the updated Policy.</p>
          </Section>

          <Section title="12. Contact Us">
            <p>QuotingHub (Pty) Ltd — Information Officer</p>
            <p><Link href="/#contact" className="text-[#9A7B4F] hover:underline">Contact us via our website</Link></p>
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
      <div className="space-y-3">{children}</div>
    </div>
  )
}
