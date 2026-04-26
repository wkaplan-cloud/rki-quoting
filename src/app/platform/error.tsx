'use client'

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: 480, width: '100%', background: '#fff', border: '1px solid #EDE9E1', borderRadius: 8, padding: 40, textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#C4A46B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Platform error</p>
        <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 600, color: '#1A1A18' }}>Something went wrong</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#8A877F', lineHeight: 1.6 }}>
          An error occurred in the platform admin. Check the server logs for details.
        </p>
        {process.env.NODE_ENV === 'development' && error.message && (
          <pre style={{ textAlign: 'left', fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: 12, marginBottom: 24, overflow: 'auto' }}>
            {error.message}
          </pre>
        )}
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
