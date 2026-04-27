import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for Johannesburg Interior Designers',
  description: 'QuotingHub is built for Johannesburg interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving Sandton, Rosebank, Bryanston, Melrose and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-johannesburg',
  },
  openGraph: {
    title: 'Quoting Software for Johannesburg Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for Johannesburg interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-johannesburg',
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
  description: 'Quoting and invoicing software for interior designers in Johannesburg, South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'Johannesburg',
    containedInPlace: {
      '@type': 'State',
      name: 'Gauteng',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function JohannesburgPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'Johannesburg',
        province: 'Gauteng',
        slug: 'interior-design-software-johannesburg',
        neighborhoods: ['Sandton', 'Rosebank', 'Bryanston', 'Melrose', 'Fourways', 'Morningside', 'Hyde Park'],
        heroSubtitle: 'Stop quoting from spreadsheets. Start winning better projects.',
        blurb: 'QuotingHub is used by interior designers and decorators across Sandton, Rosebank, Bryanston and greater Johannesburg to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
