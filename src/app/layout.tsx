import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://quotinghub.co.za'),
  title: {
    default: 'QuotingHub — Quoting Software for Interior Designers',
    template: '%s | QuotingHub',
  },
  description:
    'QuotingHub helps South African interior designers create professional quotes, invoices, and purchase orders with real-time pricing, automatic VAT calculations, PDF generation, and supplier management. No more spreadsheets.',
  keywords: [
    'quoting software interior designers',
    'interior design quotes South Africa',
    'interior designer invoice software',
    'purchase order software interior design',
    'interior design project management South Africa',
    'quoting tool South Africa',
    'interior design billing software',
    'quote generator interior design',
  ],
  authors: [{ name: 'QuotingHub', url: 'https://quotinghub.co.za' }],
  creator: 'QuotingHub',
  publisher: 'QuotingHub',
  alternates: {
    canonical: 'https://quotinghub.co.za',
  },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: 'https://quotinghub.co.za',
    siteName: 'QuotingHub',
    title: 'QuotingHub — Quoting Software for Interior Designers',
    description:
      'Create professional quotes, invoices, and purchase orders. Built for South African interior designers.',
    images: [
      {
        url: 'https://quotinghub.co.za/og-image.jpg',
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
    images: ['https://quotinghub.co.za/og-image.jpg'],
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
  url: 'https://quotinghub.co.za',
  logo: 'https://quotinghub.co.za/logo.png',
  description:
    'QuotingHub is quoting and project management software for interior designers in South Africa. Create professional quotes, invoices, and purchase orders with real-time pricing and PDF generation.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'ZA',
  },
}

const webApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'QuotingHub',
  url: 'https://quotinghub.co.za',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  browserRequirements: 'Requires JavaScript and a modern browser',
  description:
    'Quoting and project management software for interior designers in South Africa. Create professional quotes, invoices, and purchase orders with real-time supplier pricing, automatic VAT calculations, and instant PDF generation.',
  featureList: [
    'Real-time supplier pricing',
    'PDF quote and invoice generation',
    'Purchase order management per supplier',
    'Supplier and client management',
    'Automatic VAT and deposit calculations',
    'Team collaboration with role-based access',
    'Project pipeline and kanban tracking',
    'Price list import',
    'Email delivery of quotes and invoices',
  ],
  inLanguage: 'en-ZA',
  creator: {
    '@type': 'Organization',
    name: 'QuotingHub',
    url: 'https://quotinghub.co.za',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className="h-full antialiased">
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
