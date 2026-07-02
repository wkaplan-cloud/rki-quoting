'use client'
import { useEffect, useState } from 'react'

type State = 'prompting' | 'granted' | 'denied' | 'error'

export default function StaffGpsPage() {
  const [state, setState] = useState<State>('prompting')

  useEffect(() => {
    if (!navigator.geolocation) { setState('error'); return }
    navigator.geolocation.getCurrentPosition(
      () => setState('granted'),
      (err) => setState(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    )
  }, [])

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 24px',
      background: '#F0F2F5', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '32px 24px',
        maxWidth: '360px', width: '100%', textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>

        {state === 'prompting' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📍</div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#18181B', margin: '0 0 8px' }}>
              Allow location access
            </h1>
            <p style={{ fontSize: '14px', color: '#71717A', lineHeight: '1.6', margin: '0 0 24px' }}>
              Tap <strong>Allow</strong> when iOS asks for your location. This lets QuotingHub capture your GPS when you clock in.
            </p>
            <div style={{
              width: '32px', height: '32px', border: '3px solid #3A7CA5',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </>
        )}

        {state === 'granted' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#16A34A', margin: '0 0 8px' }}>
              Location enabled!
            </h1>
            <p style={{ fontSize: '14px', color: '#71717A', lineHeight: '1.6', margin: '0 0 24px' }}>
              GPS is now active. Close this tab and return to the QuotingHub app on your home screen.
            </p>
            <button
              onClick={() => window.close()}
              style={{
                background: '#16A34A', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '14px 24px', fontSize: '15px',
                fontWeight: '600', cursor: 'pointer', width: '100%',
              }}>
              Close this tab
            </button>
          </>
        )}

        {state === 'denied' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#DC2626', margin: '0 0 8px' }}>
              Location blocked
            </h1>
            <p style={{ fontSize: '14px', color: '#71717A', lineHeight: '1.6', margin: '0' }}>
              Go to <strong>Settings → Privacy &amp; Security → Location Services → Safari Websites</strong> and set to <strong>While Using</strong>, then try again.
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#D9A441', margin: '0 0 8px' }}>
              Could not get location
            </h1>
            <p style={{ fontSize: '14px', color: '#71717A', lineHeight: '1.6', margin: '0 0 24px' }}>
              Your device couldn&apos;t determine a location. Make sure Location Services is on and try again.
            </p>
            <button
              onClick={() => { setState('prompting'); navigator.geolocation.getCurrentPosition(() => setState('granted'), (e) => setState(e.code === 1 ? 'denied' : 'error'), { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }) }}
              style={{
                background: '#3A7CA5', color: '#fff', border: 'none',
                borderRadius: '12px', padding: '14px 24px', fontSize: '15px',
                fontWeight: '600', cursor: 'pointer', width: '100%',
              }}>
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}
