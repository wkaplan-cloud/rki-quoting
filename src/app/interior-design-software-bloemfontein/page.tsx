import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for Bloemfontein Interior Designers',
  description: 'QuotingHub is built for Bloemfontein interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving Langenhoven Park, Westdene, Universitas and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-bloemfontein',
  },
  openGraph: {
    title: 'Quoting Software for Bloemfontein Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for Bloemfontein interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-bloemfontein',
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
  description: 'Quoting and invoicing software for interior designers in Bloemfontein, South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'Bloemfontein',
    containedInPlace: {
      '@type': 'State',
      name: 'Free State',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function BloemfonteinPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'Bloemfontein',
        province: 'Free State',
        slug: 'interior-design-software-bloemfontein',
        neighborhoods: ['Langenhoven Park', 'Westdene', 'Universitas', 'Heuwelsig', 'Fichardt Park', 'Brandwag', 'Bayswater'],
        heroSubtitle: 'Mangaung\'s interior designers — quote faster, close more.',
        blurb: 'QuotingHub is used by interior designers and decorators across Langenhoven Park, Westdene, Universitas and greater Bloemfontein to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
