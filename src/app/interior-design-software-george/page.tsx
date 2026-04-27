import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for George Interior Designers',
  description: 'QuotingHub is built for George and Garden Route interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving Knysna, Plettenberg Bay, Mossel Bay and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-george',
  },
  openGraph: {
    title: 'Quoting Software for George Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for Garden Route interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-george',
    images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QuotingHub',
  url: 'https://quotinghub.co.za',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  description: 'Quoting and invoicing software for interior designers in George and the Garden Route, South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'George',
    containedInPlace: {
      '@type': 'State',
      name: 'Western Cape',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function GeorgePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'George',
        province: 'Western Cape',
        slug: 'interior-design-software-george',
        neighborhoods: ['Knysna', 'Plettenberg Bay', 'Mossel Bay', 'Wilderness', 'Sedgefield', 'Hartenbos', 'Great Brak River'],
        heroSubtitle: 'Garden Route designers — quote professionally, win more projects.',
        blurb: 'QuotingHub is used by interior designers and decorators across George, Knysna, Plettenberg Bay and the greater Garden Route to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
