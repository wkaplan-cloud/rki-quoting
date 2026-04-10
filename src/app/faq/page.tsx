'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is QuotingHub?',
        a: 'QuotingHub is a quoting and project management platform built specifically for interior designers. It lets you create professional quotes, invoices, and purchase orders, manage clients and suppliers, and track projects from concept to completion — all in one place.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. QuotingHub is entirely browser-based. You can access it from any device with an internet connection — desktop, laptop, or tablet. No software installation required.',
      },
      {
        q: 'Is there a free trial?',
        a: 'Yes. New accounts get a free trial period so you can explore the platform fully before committing to a subscription. No credit card is required to start your trial.',
      },
      {
        q: 'How do I get started?',
        a: 'Simply click "Get Started" on our homepage, create your account, and you\'ll be guided through setting up your studio. You can start creating quotes within minutes.',
      },
    ],
  },
  {
    category: 'Quotes & Documents',
    items: [
      {
        q: 'What documents can I generate?',
        a: 'QuotingHub generates professional PDFs for quotes, invoices, purchase orders (per supplier or combined), and production sheets. All documents are branded with your logo and studio details.',
      },
      {
        q: 'Can I send documents directly from the platform?',
        a: 'Yes. You can email quotes and invoices to clients, and purchase orders directly to suppliers, all from within the platform. A copy is logged in the project\'s email history.',
      },
      {
        q: 'How does the markup and pricing work?',
        a: 'You enter the cost price for each line item and apply a markup percentage. The system calculates the sale price, profit, and totals automatically — including VAT and any design fee. Totals update in real time as you edit.',
      },
      {
        q: 'Can I add a design fee?',
        a: 'Yes. Each project has a design fee percentage field. The design fee is calculated on the project subtotal and shown separately on quotes and invoices.',
      },
      {
        q: 'Can I group line items into sections?',
        a: 'Yes. You can create section rows (e.g. "Living Room", "Master Bedroom") to organise your line items. Sections appear as grouped headings on your PDFs.',
      },
    ],
  },
  {
    category: 'Suppliers & Clients',
    items: [
      {
        q: 'Can I manage multiple suppliers?',
        a: 'Yes. You can maintain a full supplier list with contact details, default markups, and delivery addresses. When creating a quote, you assign line items to suppliers and generate a separate purchase order for each.',
      },
      {
        q: 'What happens if a supplier has no email address?',
        a: 'If you try to send a purchase order to a supplier with no email on file, the platform will prompt you to add one. The email is saved to the supplier record so you only need to enter it once.',
      },
      {
        q: 'Can I import my existing data?',
        a: 'Yes. QuotingHub supports CSV imports for suppliers, clients, and items. This makes it easy to migrate your existing spreadsheet data into the platform.',
      },
    ],
  },
  {
    category: 'Team & Access',
    items: [
      {
        q: 'Can multiple people use the same account?',
        a: 'Yes. Studio admins can invite team members to join the studio. Team members can access projects, create quotes, and generate documents. Admins have additional access to settings and the audit log.',
      },
      {
        q: 'What is the audit log?',
        a: 'The audit log in the Admin section records all significant actions taken within your studio — who created a project, changed a status, invited a team member, and more. It\'s useful for accountability and tracking.',
      },
      {
        q: 'Can I set different permission levels?',
        a: 'Currently, QuotingHub has two roles: Admin and Member. Admins can manage team members, studio settings, and view the profit dashboard. Members can work on projects and generate documents.',
      },
    ],
  },
  {
    category: 'Billing & Subscription',
    items: [
      {
        q: 'How much does QuotingHub cost?',
        a: 'Please visit our Pricing page for current subscription plans. We offer monthly and annual billing options.',
      },
      {
        q: 'Can I cancel at any time?',
        a: 'Yes. You can cancel your subscription at any time from within the platform. Cancellation takes effect at the end of your current billing period and you retain access until then.',
      },
      {
        q: 'What happens to my data if I cancel?',
        a: 'Your data is retained for 24 months after cancellation in case you wish to return. After that period, it is permanently deleted. You can request earlier deletion by contacting us.',
      },
      {
        q: 'Do you offer refunds?',
        a: 'We do not offer refunds for partial billing periods. If you experience a technical issue that prevents you from using the Service, please contact our support team and we will assess on a case-by-case basis.',
      },
    ],
  },
  {
    category: 'Security & Privacy',
    items: [
      {
        q: 'Is my data secure?',
        a: 'Yes. All data is encrypted in transit (HTTPS) and at rest. Your studio\'s data is isolated from other studios at the database level using row-level security. We follow industry best practices for security.',
      },
      {
        q: 'Who can see my data?',
        a: 'Only you and your invited team members can see your studio\'s data. Our support team may access data only when necessary to resolve a support request, and only with your consent.',
      },
      {
        q: 'Is QuotingHub POPIA compliant?',
        a: 'Yes. We take our obligations under the Protection of Personal Information Act (POPIA) seriously. You have the right to access, correct, or request deletion of your personal data at any time. See our Privacy Policy for full details.',
      },
      {
        q: 'Can I enable two-factor authentication?',
        a: 'Yes. Two-factor authentication (2FA) via an authenticator app is available in your account security settings.',
      },
    ],
  },
  {
    category: 'Support',
    items: [
      {
        q: 'How do I get help?',
        a: 'You can contact us via the contact form on our website or email us at support@quotinghub.co.za. We aim to respond within one business day.',
      },
      {
        q: 'Do you offer onboarding or training?',
        a: 'Yes. We offer guided onboarding to help you get set up quickly. Contact us after signing up and we\'ll schedule a walkthrough.',
      },
    ],
  },
]

export default function FAQPage() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link href="/"><img src="/logo.png" alt="QuotingHub" className="h-10 w-auto object-contain" /></Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href="/signup" className="px-4 py-2 text-sm bg-[#1A1A18] text-white rounded-lg hover:bg-[#2C2C2A] transition-colors font-medium">Get Started</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <p className="text-xs text-[#9A7B4F] uppercase tracking-widest font-semibold mb-3">Support</p>
        <h1 className="font-serif text-4xl text-[#1A1A18] tracking-tight mb-3">Frequently Asked Questions</h1>
        <p className="text-sm text-[#8A877F] mb-12 leading-relaxed">Everything you need to know about QuotingHub. Can&apos;t find the answer? <a href="mailto:support@quotinghub.co.za" className="text-[#9A7B4F] hover:underline">Email us</a>.</p>

        <div className="space-y-12">
          {faqs.map(cat => (
            <div key={cat.category}>
              <h2 className="text-xs font-semibold text-[#9A7B4F] uppercase tracking-widest mb-4">{cat.category}</h2>
              <div className="divide-y divide-[#EDE9E1] border-t border-[#EDE9E1]">
                {cat.items.map(item => {
                  const key = `${cat.category}-${item.q}`
                  const isOpen = open === key
                  return (
                    <div key={item.q}>
                      <button
                        onClick={() => setOpen(isOpen ? null : key)}
                        className="w-full text-left py-4 flex items-start justify-between gap-4 cursor-pointer"
                      >
                        <span className="text-sm font-medium text-[#1A1A18]">{item.q}</span>
                        <ChevronDown size={16} className={`flex-shrink-0 mt-0.5 text-[#8A877F] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <p className="text-sm text-[#4A4A47] leading-relaxed pb-4">{item.a}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-white border border-[#D8D3C8] rounded-2xl p-8 text-center">
          <h3 className="font-serif text-xl text-[#1A1A18] mb-2">Still have questions?</h3>
          <p className="text-sm text-[#8A877F] mb-5">Our team is happy to help.</p>
          <a href="mailto:support@quotinghub.co.za" className="inline-block px-6 py-2.5 bg-[#1A1A18] text-white text-sm font-medium rounded-lg hover:bg-[#2C2C2A] transition-colors">
            Contact Support
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-[#D8D3C8] flex flex-wrap gap-6 text-xs text-[#8A877F]">
          <Link href="/terms" className="hover:text-[#9A7B4F] transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-[#9A7B4F] transition-colors">Privacy Policy</Link>
          <Link href="/pricing" className="hover:text-[#9A7B4F] transition-colors">Pricing</Link>
          <Link href="/" className="hover:text-[#9A7B4F] transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  )
}
