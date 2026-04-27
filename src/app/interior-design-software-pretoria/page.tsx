import type { Metadata } from 'next'
import { CityLandingPage } from '../_components/CityLandingPage'

export const metadata: Metadata = {
  title: 'Quoting Software for Pretoria Interior Designers',
  description: 'QuotingHub is built for Pretoria interior designers and decorators. Create professional quotes, invoices, and purchase orders with real-time pricing. Serving Waterkloof, Centurion, Menlyn, Brooklyn and beyond.',
  alternates: {
    canonical: 'https://quotinghub.co.za/interior-design-software-pretoria',
  },
  openGraph: {
    title: 'Quoting Software for Pretoria Interior Designers | QuotingHub',
    description: 'Professional quoting, invoicing, and purchase orders for Pretoria interior designers. Real-time supplier pricing, instant PDFs, and automatic calculations.',
    url: 'https://quotinghub.co.za/interior-design-software-pretoria',
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
  description: 'Quoting and invoicing software for interior designers in Pretoria, South Africa.',
  areaServed: {
    '@type': 'City',
    name: 'Pretoria',
    containedInPlace: {
      '@type': 'State',
      name: 'Gauteng',
      containedInPlace: { '@type': 'Country', name: 'South Africa' },
    },
  },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

export default function PretoriaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />
      <CityLandingPage config={{
        city: 'Pretoria',
        province: 'Gauteng',
        slug: 'interior-design-software-pretoria',
        neighborhoods: ['Waterkloof', 'Centurion', 'Menlyn', 'Brooklyn', 'Hatfield', 'Lynnwood', 'Faerie Glen'],
        heroSubtitle: 'From Waterkloof to Centurion — quote faster, win more projects.',
        blurb: 'QuotingHub is used by interior designers and decorators across Waterkloof, Centurion, Brooklyn and greater Pretoria to create professional quotes, invoices, and purchase orders in minutes — with real-time supplier pricing and automatic calculations.',
      }} />
    </>
  )
}
