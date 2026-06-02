import Image from 'next/image'

const THEMES = {
  studio: { bg: '#F5F2EC', text: '#9A7B4F', spinner: '#9A7B4F' },
  elec:   { bg: '#F5F7F9', text: '#3A7CA5', spinner: '#3A7CA5' },
}

export function LoadingScreen({ variant = 'studio' }: { variant?: 'studio' | 'elec' }) {
  const t = THEMES[variant]
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: t.bg }}>
      <Image
        src="/logo.png"
        alt="QuotingHub"
        width={240}
        height={96}
        className="h-24 w-auto object-contain opacity-80"
        priority
      />
      <div className="flex items-center gap-2 text-sm" style={{ color: t.text }}>
        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: t.spinner, borderTopColor: 'transparent' }} />
        Loading…
      </div>
    </div>
  )
}
