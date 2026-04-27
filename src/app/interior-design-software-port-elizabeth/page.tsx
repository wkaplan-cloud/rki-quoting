import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for Port Elizabeth Interior Designers',
  description: 'QuotingHub is built for Port Elizabeth (Gqeberha) interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving Summerstrand, Mill Park, Walmer and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-port-elizabeth',
  },
  openGraph: {
    title: 'Quoting Software for Port Elizabeth Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for Port Elizabeth interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-port-elizabeth',
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
  description: 'Quoting and invoicing software for interior designers in Port Elizabeth (Gqeberha), South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'Port Elizabeth',
    alternateName: 'Gqeberha',
    containedInPlace: {
      '@type': 'State',
      name: 'Eastern Cape',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function PortElizabethPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'Port Elizabeth',
        province: 'Eastern Cape',
        slug: 'interior-design-software-port-elizabeth',
        neighborhoods: ['Summerstrand', 'Mill Park', 'Walmer', 'Humewood', 'Newton Park', 'Lorraine', 'Framesby'],
        heroSubtitle: 'The Friendly City\'s interior designers deserve better than spreadsheets.',
        blurb: 'QuotingHub is used by interior designers and decorators across Summerstrand, Mill Park, Walmer and greater Port Elizabeth (Gqeberha) to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
