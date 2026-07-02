'use client'
import { useEffect, useState } from 'react'

type State = 'prompting' | 'granted' | 'denied' | 'error'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF',
  accent: '#3A7CA5', green: '#16A34A', danger: '#DC2626',
  text: '#18181B', muted: '#71717A', border: '#E4E4E7',
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
  const [state, setState] = useState<State>('prompting')

  function tryGps() {
    setState('prompting')
    navigator.geolocation.getCurrentPosition(
      () => setState('granted'),
      (err) => setState(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    )
  }

  useEffect(() => {
    if (!navigator.geolocation) { setState('error'); return }
    tryGps()
  }, []) // eslint-disable-line

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

        {state === 'prompting' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>📍</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: S.text, margin: '0 0 8px' }}>
              Waiting for permission…
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

        {state === 'denied' && (
          <>
            <div style={{ fontSize: '44px', marginBottom: '12px', textAlign: 'center' }}>🔒</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: S.danger, margin: '0 0 4px', textAlign: 'center' }}>
              Location blocked
            </h1>
            <p style={{ fontSize: '13px', color: S.muted, margin: '0 0 20px', textAlign: 'center' }}>
              iOS has previously blocked GPS for this app. Follow the steps below to reset it.
            </p>

            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '12px', background: S.bg }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Option 1 — Settings</p>
              <Step n={1}>Open <strong>Settings</strong> on your iPhone</Step>
              <Step n={2}>Go to <strong>Privacy &amp; Security → Location Services</strong></Step>
              <Step n={3}>Scroll down and look for <strong>QuotingHub</strong> or <strong>quotinghub.co.za</strong></Step>
              <Step n={4}>Set it to <strong>While Using</strong>, then come back and tap Retry below</Step>
            </div>

            <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '12px', background: '#FEF9EC', border: '1px solid rgba(217,164,65,0.3)' }}>
              <p style={{ fontSize: '11px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Option 2 — Reset the app</p>
              <Step n={1}><strong>Press and hold</strong> the QuotingHub icon on your home screen → <strong>Remove App</strong></Step>
              <Step n={2}>Open Safari, go to <strong>quotinghub.co.za</strong>, log in, and tap <strong>Enable GPS</strong> — allow when prompted</Step>
              <Step n={3}><strong>Add to Home Screen</strong> again from the Safari share button</Step>
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

        {state === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚠️</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#D9A441', margin: '0 0 8px' }}>Couldn&apos;t get location</h1>
            <p style={{ fontSize: '13px', color: S.muted, lineHeight: '1.6', margin: '0 0 20px' }}>
              Make sure Location Services is turned on in Settings, then try again.
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
