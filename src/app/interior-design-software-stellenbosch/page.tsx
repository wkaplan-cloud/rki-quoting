import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for Stellenbosch Interior Designers',
  description: 'QuotingHub is built for Stellenbosch interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving the Winelands, Franschhoek, Paarl and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-stellenbosch',
  },
  openGraph: {
    title: 'Quoting Software for Stellenbosch Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for Stellenbosch interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-stellenbosch',
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
  description: 'Quoting and invoicing software for interior designers in Stellenbosch and the Cape Winelands, South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'Stellenbosch',
    containedInPlace: {
      '@type': 'State',
      name: 'Western Cape',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function StellenboschPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'Stellenbosch',
        province: 'Western Cape',
        slug: 'interior-design-software-stellenbosch',
        neighborhoods: ['Dorp Street', 'Die Boord', 'Paradyskloof', 'Franschhoek', 'Paarl', 'Somerset West', 'Strand'],
        heroSubtitle: 'Winelands designers deserve a quoting system as refined as their work.',
        blurb: 'QuotingHub is used by interior designers and decorators across Stellenbosch, Franschhoek, Paarl and the greater Cape Winelands to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
