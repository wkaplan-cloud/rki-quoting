'use client'

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F2EC', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 480, padding: '40px 32px', background: '#fff', borderRadius: 8, border: '1px solid #EDE9E1', textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#C4A46B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Something went wrong</p>
        <h1 style={{ margin: '0 0 16px', fontSize: 22, fontWeight: 600, color: '#1A1A18' }}>Unexpected error</h1>
        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#8A877F', lineHeight: 1.6 }}>
          An unexpected error occurred. If this keeps happening, please contact support.
        </p>
        <button
          onClick={reset}
          style={{ padding: '10px 24px', background: '#2C2C2A', color: '#F5F2EC', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
