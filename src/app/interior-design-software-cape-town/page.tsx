import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for Cape Town Interior Designers | QuotingHub',
  description: 'QuotingHub is built for Cape Town interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving Atlantic Seaboard, Constantia, Bishopscourt, De Waterkant and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-cape-town',
  },
  openGraph: {
    title: 'Quoting Software for Cape Town Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for Cape Town interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-cape-town',
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
  description: 'Quoting and invoicing software for interior designers in Cape Town, South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'Cape Town',
    containedInPlace: {
      '@type': 'State',
      name: 'Western Cape',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function CapeTownPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'Cape Town',
        province: 'Western Cape',
        slug: 'interior-design-software-cape-town',
        neighborhoods: ['Atlantic Seaboard', 'Constantia', 'Bishopscourt', 'De Waterkant', 'Blouberg', 'Hout Bay', 'Camps Bay'],
        heroSubtitle: 'Every project, perfectly quoted — from Sea Point to Stellenbosch.',
        blurb: 'QuotingHub is used by interior designers and decorators across the Atlantic Seaboard, Constantia, De Waterkant and greater Cape Town to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
