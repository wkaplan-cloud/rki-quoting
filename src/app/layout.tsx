import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Toaster } from 'react-hot-toast'
import './globals.css'

// Fonts are self-hosted (latin subset, from Fontsource) rather than loaded via
// next/font/google: fetching them from Google during the Vercel build failed
// intermittently under Turbopack and broke deploys.

const playfair = localFont({
  src: [
    { path: './fonts/playfair-display-latin-wght-normal.woff2', weight: '400 700', style: 'normal' },
    { path: './fonts/playfair-display-latin-wght-italic.woff2', weight: '400 700', style: 'italic' },
  ],
  variable: '--font-playfair',
  display: 'swap',
})

const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  weight: '300 600',
  variable: '--font-inter',
  display: 'swap',
})

// Studio's board-wide "content font" choices (src/lib/studio/contentFonts.ts)
// — the 4 most popular free Google Fonts, applied to every text object on
// every slide of a board.
const roboto = localFont({
  src: './fonts/roboto-latin-wght-normal.woff2',
  weight: '400 700',
  variable: '--font-roboto',
  display: 'swap',
})

const montserrat = localFont({
  src: './fonts/montserrat-latin-wght-normal.woff2',
  weight: '400 700',
  variable: '--font-montserrat',
  display: 'swap',
})

const lato = localFont({
  src: [
    { path: './fonts/lato-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/lato-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-lato',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1A1A18',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.quotinghub.co.za'),
  title: {
    default: 'QuotingHub — Quoting Software for Interior Designers',
    template: '%s | QuotingHub',
  },
  description:
    'QuotingHub helps South African interior designers create professional quotes, invoices, and purchase orders from supplier price lists, with automatic VAT calculations, PDF generation, and supplier management. No more spreadsheets.',
  keywords: [
    'quoting software interior designers',
    'interior design quotes South Africa',
    'interior designer invoice software',
    'purchase order software interior design',
    'interior design project management South Africa',
    'quoting tool South Africa',
    'interior design billing software',
    'quote generator interior design',
    'quoting software for electricians South Africa',
    'electrician quoting software',
    'electrical quotation software',
    'digital COC software South Africa',
    'job card software South Africa',
    'quoting software for installers',
    'home automation quoting software',
    'CCTV installer quoting software',
    'AV installer quoting software',
  ],
  authors: [{ name: 'QuotingHub', url: 'https://www.quotinghub.co.za' }],
  creator: 'QuotingHub',
  publisher: 'QuotingHub',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png',   sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    title: 'QuotingHub',
    statusBarStyle: 'default',
  },
  alternates: {
    canonical: 'https://www.quotinghub.co.za',
  },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: 'https://www.quotinghub.co.za',
    siteName: 'QuotingHub',
    title: 'QuotingHub — Quoting Software for Interior Designers',
    description:
      'Create professional quotes, invoices, and purchase orders. Built for South African interior designers.',
    images: [
      {
        url: 'https://www.quotinghub.co.za/og-image.png',
        width: 1200,
        height: 630,
        alt: 'QuotingHub — Quoting Software for Interior Designers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuotingHub — Quoting Software for Interior Designers',
    description:
      'Professional quoting, invoicing, and purchase orders for South African interior designers.',
    images: ['https://www.quotinghub.co.za/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
}

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'QuotingHub',
  url: 'https://www.quotinghub.co.za',
  logo: 'https://www.quotinghub.co.za/logo.png',
  description:
    'QuotingHub is South African quoting and business software for three kinds of business: interior designers and decorators (quotes, invoices and supplier purchase orders from price lists), electricians (quotes, progress claims, digital COCs, job cards and GPS clocking), and home automation, AV, CCTV and networking installers (room-by-room quotes with kits, device registers, handover packs and support contracts).',
  knowsAbout: [
    'Interior design quoting',
    'Electrical quotations',
    'Certificate of Compliance (COC) under SANS 10142-1',
    'Home automation and CCTV installation quoting',
    'South African VAT invoicing',
    'Job cards and field staff timesheets',
  ],
  sameAs: ['https://www.capterra.co.za/software/1107816/QuotingHub'],
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'ZA',
  },
}

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'QuotingHub',
  url: 'https://www.quotinghub.co.za',
  logo: 'https://www.quotinghub.co.za/logo.png',
  description: 'Quoting and business software for South African interior designers, electricians and home automation, AV and CCTV installers.',
  areaServed: [
    { '@type': 'City', name: 'Johannesburg' },
    { '@type': 'City', name: 'Cape Town' },
    { '@type': 'City', name: 'Durban' },
    { '@type': 'Country', name: 'South Africa' },
  ],
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'ZA',
  },
  sameAs: ['https://www.capterra.co.za/software/1107816/QuotingHub'],
}

const webApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'QuotingHub',
  url: 'https://www.quotinghub.co.za',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  browserRequirements: 'Requires JavaScript and a modern browser',
  description:
    'Quoting and business software built in South Africa for interior designers, electricians, and home automation, AV and CCTV installers. Quotes, invoices, purchase orders, progress claims, digital COCs, job cards, GPS clocking, device registers and support contracts, with 15% VAT, rand pricing and Sage integration.',
  audience: [
    { '@type': 'BusinessAudience', audienceType: 'Interior designers and decorators' },
    { '@type': 'BusinessAudience', audienceType: 'Electricians and electrical contractors' },
    { '@type': 'BusinessAudience', audienceType: 'Home automation, AV, CCTV and networking installers' },
  ],
  areaServed: { '@type': 'Country', name: 'South Africa' },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'ZAR',
    lowPrice: '699',
    highPrice: '4499',
    offerCount: 9,
  },
  featureList: [
    'Supplier price lists in every quote',
    'PDF quote and invoice generation',
    'Purchase order management per supplier',
    'Supplier and client management',
    'Automatic VAT and deposit calculations',
    'Team collaboration with role-based access',
    'Project pipeline and kanban tracking',
    'Price list import',
    'Email delivery of quotes and invoices',
    'Electrical quotes with sections, labour and materials',
    'Monthly progress claims and variation orders',
    'Digital Certificate of Compliance (SANS 10142-1)',
    'Job cards for callouts, maintenance and repairs',
    'GPS clock-in and clock-out for staff',
    'Room-by-room installer quotes with kits and good/better/best options',
    'Device register with serial, MAC and IP per site',
    'Client handover packs',
    'Support contracts with automatic recurring invoices',
    'Sage Business Cloud Accounting integration',
  ],
  inLanguage: 'en-ZA',
  creator: {
    '@type': 'Organization',
    name: 'QuotingHub',
    url: 'https://www.quotinghub.co.za',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-ZA"
      className={`h-full antialiased ${playfair.variable} ${inter.variable} ${roboto.variable} ${montserrat.variable} ${lato.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema).replace(/</g, '\\u003c'),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusinessSchema).replace(/</g, '\\u003c'),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(webApplicationSchema).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body className="min-h-full">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#2C2C2A',
              color: '#F5F2EC',
              fontSize: '0.875rem',
              borderRadius: '4px',
            },
          }}
        />
      </body>
    </html>
  )
}
