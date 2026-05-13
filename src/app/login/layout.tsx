import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Log In — QuotingHub',
  description: 'Log in to your QuotingHub account to manage quotes, invoices, and purchase orders.',
  robots: { index: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
