import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Variation Order | QuotingHub' },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
