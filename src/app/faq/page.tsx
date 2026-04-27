import type { Metadata } from 'next'
import { FAQContent } from './FAQContent'
import { faqs } from './faq-data'

export const metadata: Metadata = {
  title: 'FAQ — QuotingHub for Interior Designers',
  description: 'Common questions about QuotingHub: setup, billing, features, and how it works for interior designers and decorators in South Africa.',
  alternates: {
    canonical: 'https://quotinghub.co.za/faq',
  },
  openGraph: {
    title: 'FAQ — QuotingHub for Interior Designers',
    description: 'Common questions about QuotingHub: setup, billing, features, and how it works for interior designers in South Africa.',
    url: 'https://quotinghub.co.za/faq',
    images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
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
