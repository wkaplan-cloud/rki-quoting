export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'

export default async function QuotingSettingsPage({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const params = await searchParams
  const upgraded = params.upgraded === '1'
  redirect(`/supplier-portal/profile?tab=settings${upgraded ? '&upgraded=1' : ''}`)
}
