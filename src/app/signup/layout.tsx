import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up — QuotingHub',
  description: 'Start your free 30-day trial. No credit card required. QuotingHub is quoting software built for South African interior designers.',
  robots: { index: false },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
