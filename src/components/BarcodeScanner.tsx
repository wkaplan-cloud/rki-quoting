'use client'
import { useEffect, useRef, useState } from 'react'
import { X, ScanLine, Loader2 } from 'lucide-react'

/**
 * Full-screen camera scanner for serial-number and MAC barcodes (Code 128,
 * QR, Data Matrix — whatever is on the device label). The reader library is
 * loaded only when the scanner opens, so it costs nothing until it's used.
 */
export function BarcodeScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)
  // Held in a ref so a parent re-rendering with a new callback doesn't restart the camera.
  const onResultRef = useRef(onResult)
  useEffect(() => { onResultRef.current = onResult }, [onResult])

  useEffect(() => {
    let stopped = false
    let stop: (() => void) | null = null

    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (stopped || !videoRef.current) return
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result, _err, ctrl) => {
            if (!result) return
            ctrl.stop()
            onResultRef.current(result.getText().trim())
          },
        )
        stop = () => controls.stop()
        if (stopped) stop()
        setStarting(false)
      } catch (e) {
        setStarting(false)
        const name = e instanceof Error ? e.name : ''
        setError(name === 'NotAllowedError'
          ? 'Camera access was blocked. Allow the camera for this site, or type the number instead.'
          : 'Could not start the camera on this device. Type the number instead.')
      }
    })()

    return () => { stopped = true; stop?.() }
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: '#000' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ color: '#fff' }}>
        <span className="flex items-center gap-2 text-sm font-semibold"><ScanLine size={16} /> Point at the barcode</span>
        <button onClick={onClose} aria-label="Close scanner" className="p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <X size={18} />
        </button>
      </div>
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        {/* aiming frame */}
        {!error && (
          <div className="absolute pointer-events-none rounded-xl"
            style={{ width: '78%', maxWidth: 420, height: 150, border: '2px solid rgba(255,255,255,0.85)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
        )}
        {starting && !error && <Loader2 size={28} className="absolute animate-spin" style={{ color: '#fff' }} />}
        {error && (
          <p className="absolute px-6 text-center text-sm" style={{ color: '#fff', maxWidth: 360 }}>{error}</p>
        )}
      </div>
    </div>
  )
}
