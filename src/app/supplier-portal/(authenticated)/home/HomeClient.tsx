'use client'

interface Props {
  companyName: string
}

export function HomeClient({ companyName }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium mb-1" style={{ color: '#94A3B8' }}>{dateStr}</p>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#111827' }}>
          {greeting}, <span style={{ color: '#1E2A38' }}>{companyName}</span>
        </h1>
      </div>

      <div className="rounded-xl p-14 text-center" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: '#111827' }}>You&apos;ll be contacted directly</p>
        <p className="text-sm max-w-sm mx-auto" style={{ color: '#6B7280' }}>
          Studios reach out by email when they&apos;d like a quote — nothing to check here. Use{' '}
          <span className="font-medium">My Price List</span> to keep your pricing up to date for them.
        </p>
      </div>
    </div>
  )
}
