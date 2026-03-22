import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'RKI Quoting',
  description: 'R Kaplan Interiors — Quoting & Invoice System',
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
