import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'QuotingHub',
  description: 'QuotingHub — Quoting, Invoicing & Purchase Orders for Interior Designers',
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
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
