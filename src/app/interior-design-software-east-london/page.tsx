import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for East London Interior Designers',
  description: 'QuotingHub is built for East London interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving Beacon Bay, Nahoon, Vincent and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-east-london',
  },
  openGraph: {
    title: 'Quoting Software for East London Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for East London interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-east-london',
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
  description: 'Quoting and invoicing software for interior designers in East London, South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'East London',
    containedInPlace: {
      '@type': 'State',
      name: 'Eastern Cape',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function EastLondonPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'East London',
        province: 'Eastern Cape',
        slug: 'interior-design-software-east-london',
        neighborhoods: ['Beacon Bay', 'Nahoon', 'Vincent', 'Gonubie', 'Berea', 'Quigney', 'Cambridge'],
        heroSubtitle: 'East London\'s designers — stop quoting from spreadsheets.',
        blurb: 'QuotingHub is used by interior designers and decorators across Beacon Bay, Nahoon, Vincent and greater East London to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
