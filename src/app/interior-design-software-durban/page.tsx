import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for Durban Interior Designers | QuotingHub',
  description: 'QuotingHub is built for Durban interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving Umhlanga, Ballito, La Lucia, Berea and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-durban',
  },
  openGraph: {
    title: 'Quoting Software for Durban Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for Durban interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-durban',
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
  description: 'Quoting and invoicing software for interior designers in Durban, South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'Durban',
    containedInPlace: {
      '@type': 'State',
      name: 'KwaZulu-Natal',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function DurbanPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'Durban',
        province: 'KwaZulu-Natal',
        slug: 'interior-design-software-durban',
        neighborhoods: ['Umhlanga', 'Ballito', 'La Lucia', 'Berea', 'Morningside', 'Westville', 'Hillcrest'],
        heroSubtitle: 'Professional quoting for KwaZulu-Natal\'s fastest growing design studios.',
        blurb: 'QuotingHub is used by interior designers and decorators across Umhlanga, Ballito, La Lucia and greater Durban to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
