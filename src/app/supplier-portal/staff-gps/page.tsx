'use client'
import { useState } from 'react'

type State = 'idle' | 'prompting' | 'granted' | 'denied' | 'error'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF',
  accent: '#3A7CA5', green: '#16A34A', danger: '#DC2626',
  text: '#18181B', muted: '#71717A',
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
      <div style={{
        width: '24px', height: '24px', borderRadius: '50%', background: S.accent,
        color: '#fff', fontSize: '12px', fontWeight: '700', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</div>
      <p style={{ fontSize: '14px', color: S.text, lineHeight: '1.6', margin: 0 }}>{children}</p>
    </div>
  )
}

export default function StaffGpsPage() {
  const [state, setState] = useState<State>('idle')

  // Must be called directly from a button tap — iOS requires a real user gesture
  function tryGps() {
    if (!navigator.geolocation) { setState('error'); return }
    setState('prompting')
    navigator.geolocation.getCurrentPosition(
      () => setState('granted'),
      (err) => setState(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '32px 16px',
      background: S.bg, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: S.card, borderRadius: '20px', padding: '28px 20px',
        maxWidth: '380px', width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>

        {/* Idle — waiting for tap */}
        {state === 'idle' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>📍</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: S.text, margin: '0 0 8px' }}>
              Enable GPS
            </h1>
            <p style={{ fontSize: '13px', color: S.muted, lineHeight: '1.6', margin: '0 0 20px' }}>
              Tap the button below. If iOS shows a location dialog, tap <strong>Allow</strong>.
            </p>
            <button onClick={tryGps} style={{
              background: S.accent, color: '#fff', border: 'none', borderRadius: '12px',
              padding: '16px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%',
            }}>
              Enable GPS
            </button>
          </div>
        )}

        {/* Prompting */}
        {state === 'prompting' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>📍</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: S.text, margin: '0 0 8px' }}>
              Waiting…
            </h1>
            <p style={{ fontSize: '13px', color: S.muted, lineHeight: '1.6', margin: '0 0 20px' }}>
              If a dialog appeared, tap <strong>Allow</strong>.
            </p>
            <div style={{
              width: '28px', height: '28px', border: `3px solid ${S.accent}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Granted */}
        {state === 'granted' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>✅</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: S.green, margin: '0 0 8px' }}>GPS enabled!</h1>
            <p style={{ fontSize: '13px', color: S.muted, lineHeight: '1.6', margin: '0 0 20px' }}>
              Location will now be captured when you clock in/out.
            </p>
            <button onClick={() => history.back()} style={{
              background: S.green, color: '#fff', border: 'none', borderRadius: '12px',
              padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', width: '100%',
            }}>
              Back to app
            </button>
          </div>
        )}

        {/* Denied — permission is stuck in denied state in iOS storage */}
        {state === 'denied' && (
          <>
            <div style={{ fontSize: '44px', marginBottom: '12px', textAlign: 'center' }}>🔒</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: S.danger, margin: '0 0 4px', textAlign: 'center' }}>
              Location blocked
            </h1>
            <p style={{ fontSize: '13px', color: S.muted, margin: '0 0 20px', textAlign: 'center', lineHeight: '1.5' }}>
              iOS has this app&apos;s GPS blocked in storage. Follow one of these steps to fix it.
            </p>

            {/* Option 1 */}
            <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: S.bg }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
                Option 1 — Clear website data
              </p>
              <Step n={1}>Open <strong>Settings → Safari → Advanced → Website Data</strong></Step>
              <Step n={2}>Search for <strong>quotinghub</strong> and swipe to delete it</Step>
              <Step n={3}>Come back here and tap <strong>Retry</strong> below — the GPS dialog should appear</Step>
            </div>

            {/* Option 2 */}
            <div style={{ marginBottom: '16px', padding: '16px', borderRadius: '12px', background: '#FFFBEB', border: '1px solid rgba(217,164,65,0.3)' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>
                Option 2 — Check Location Services
              </p>
              <Step n={1}><strong>Settings → Privacy &amp; Security → Location Services</strong></Step>
              <Step n={2}>Look for <strong>QuotingHub</strong> or <strong>quotinghub.co.za</strong> in the list</Step>
              <Step n={3}>If found, set to <strong>While Using</strong> → tap Retry</Step>
            </div>

            <button onClick={tryGps} style={{
              background: S.accent, color: '#fff', border: 'none', borderRadius: '12px',
              padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', width: '100%',
            }}>
              Retry
            </button>
            <button onClick={() => history.back()} style={{
              background: 'transparent', color: S.muted, border: 'none',
              padding: '12px', fontSize: '14px', cursor: 'pointer', width: '100%', marginTop: '4px',
            }}>
              Skip for now
            </button>
          </>
        )}

        {/* Error */}
        {state === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚠️</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#D9A441', margin: '0 0 8px' }}>
              Couldn&apos;t get location
            </h1>
            <p style={{ fontSize: '13px', color: S.muted, lineHeight: '1.6', margin: '0 0 20px' }}>
              Make sure Location Services is on in Settings, then try again.
            </p>
            <button onClick={tryGps} style={{
              background: S.accent, color: '#fff', border: 'none', borderRadius: '12px',
              padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', width: '100%',
            }}>
              Try again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
