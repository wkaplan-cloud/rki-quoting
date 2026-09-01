'use client'
import { useState, useEffect, useRef } from 'react'

type State = 'idle' | 'switch-to-safari' | 'granted' | 'denied' | 'error'

const S = {
  bg: '#F0F2F5', card: '#FFFFFF',
  accent: '#3A7CA5', green: '#16A34A', danger: '#DC2626',
  text: '#18181B', muted: '#71717A',
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '12px' }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%', background: S.accent,
        color: '#fff', fontSize: '12px', fontWeight: '700', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</div>
      <p style={{ fontSize: '14px', color: S.text, lineHeight: '1.6', margin: 0 }}>{children}</p>
    </div>
  )
}

export default function StaffGpsPage() {
  const [state, setState] = useState<State>('idle')
  const [countdown, setCountdown] = useState(10)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // When user comes back from Safari after granting, re-check permission
  useEffect(() => {
    const onFocus = () => {
      if (state !== 'switch-to-safari') return
      navigator.geolocation.getCurrentPosition(
        () => { clearTimer(); setState('granted') },
        (err) => { clearTimer(); setState(err.code === 1 ? 'denied' : 'idle') },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      )
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [state])

  // Fire the geolocation request — on iOS standalone the dialog appears in Safari
  function requestGps() {
    if (!navigator.geolocation) { setState('error'); return }

    // Start countdown so user knows to switch quickly
    setCountdown(10)
    setState('switch-to-safari')

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearTimer(); return 0 }
        return prev - 1
      })
    }, 1000)

    // Fire the request — iOS will route the dialog to a Safari tab
    navigator.geolocation.getCurrentPosition(
      () => { clearTimer(); setState('granted') },
      (err) => { clearTimer(); setState(err.code === 1 ? 'denied' : 'idle') },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
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

        {/* Step 1 — explain what to do */}
        {state === 'idle' && (
          <>
            <div style={{ fontSize: '40px', marginBottom: '12px', textAlign: 'center' }}>📍</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: S.text, margin: '0 0 6px', textAlign: 'center' }}>
              Enable GPS
            </h1>
            <p style={{ fontSize: '13px', color: S.muted, margin: '0 0 20px', textAlign: 'center', lineHeight: '1.5' }}>
              Due to an iOS bug, the permission dialog appears in <strong>Safari</strong>, not here. Read the steps first, then tap the button.
            </p>
            <div style={{ padding: '16px', borderRadius: '12px', background: S.bg, marginBottom: '20px' }}>
              <Step n={1}>Tap <strong>Enable GPS</strong> below</Step>
              <Step n={2}>Immediately press the <strong>Home button</strong> and open <strong>Safari</strong></Step>
              <Step n={3}>A location dialog will be showing in Safari — tap <strong>Allow</strong></Step>
              <Step n={4}>Come back here — GPS will be active</Step>
            </div>
            <button onClick={requestGps} style={{
              background: S.accent, color: '#fff', border: 'none', borderRadius: '12px',
              padding: '16px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%',
            }}>
              Enable GPS
            </button>
          </>
        )}

        {/* Step 2 — request fired, user needs to switch to Safari */}
        {state === 'switch-to-safari' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '52px', marginBottom: '8px' }}>
              {countdown > 0 ? countdown : '⏱'}
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: S.accent, margin: '0 0 8px' }}>
              Open Safari now!
            </h1>
            <p style={{ fontSize: '14px', color: S.text, lineHeight: '1.6', margin: '0 0 6px' }}>
              Press the <strong>Home button</strong> and open <strong>Safari</strong>.
            </p>
            <p style={{ fontSize: '13px', color: S.muted, lineHeight: '1.5', margin: 0 }}>
              The location dialog is waiting there — tap <strong>Allow</strong> then come back here.
            </p>
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

        {/* Denied */}
        {state === 'denied' && (
          <>
            <div style={{ fontSize: '44px', marginBottom: '12px', textAlign: 'center' }}>🔒</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: S.danger, margin: '0 0 4px', textAlign: 'center' }}>
              Location blocked
            </h1>
            <p style={{ fontSize: '13px', color: S.muted, margin: '0 0 20px', textAlign: 'center', lineHeight: '1.5' }}>
              GPS was denied. To reset it, go to:
            </p>
            <div style={{ padding: '16px', borderRadius: '12px', background: S.bg, marginBottom: '20px' }}>
              <Step n={1}><strong>Settings → Privacy &amp; Security → Location Services</strong></Step>
              <Step n={2}>Find <strong>Safari Websites</strong> or <strong>QuotingHub</strong> in the list</Step>
              <Step n={3}>Set to <strong>While Using App or Website</strong></Step>
              <Step n={4}>Come back and tap Retry</Step>
            </div>
            <button onClick={requestGps} style={{
              background: S.accent, color: '#fff', border: 'none', borderRadius: '12px',
              padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', width: '100%',
            }}>
              Retry
            </button>
            <button onClick={() => { localStorage.setItem('gps_banner_dismissed', '1'); history.back() }} style={{
              background: 'transparent', color: S.muted, border: 'none',
              padding: '12px', fontSize: '14px', cursor: 'pointer', width: '100%', marginTop: '4px',
            }}>
              Skip for now
            </button>
          </>
        )}

        {/* Error / timed out */}
        {state === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚠️</div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#D9A441', margin: '0 0 8px' }}>Timed out</h1>
            <p style={{ fontSize: '13px', color: S.muted, lineHeight: '1.6', margin: '0 0 20px' }}>
              The dialog may have expired. Tap Try again and switch to Safari faster.
            </p>
            <button onClick={requestGps} style={{
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
