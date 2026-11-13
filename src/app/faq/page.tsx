import type { Metadata } from 'next'
import { FAQContent } from './FAQContent'
import { faqs } from './faq-data'

export const metadata: Metadata = {
  title: 'QuotingHub FAQ — Quoting Software for SA Designers, Electricians & Installers',
  description: 'Answers about QuotingHub for South African interior designers, electricians, and home automation, AV and CCTV installers: pricing in rand, COCs, progress claims, Sage and Xero, VAT and the free trial.',
  alternates: {
    canonical: 'https://www.quotinghub.co.za/faq',
  },
  openGraph: {
    title: 'QuotingHub FAQ — Quoting Software for SA Designers, Electricians & Installers',
    description: 'Answers about QuotingHub for South African interior designers, electricians and installers: pricing in rand, COCs, progress claims, Sage and Xero, VAT and the free trial.',
    url: 'https://www.quotinghub.co.za/faq',
    images: [{ url: 'https://www.quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.flatMap(cat =>
    cat.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    }))
  ),
}

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
      />
      <FAQContent />
    </>
  )
}
