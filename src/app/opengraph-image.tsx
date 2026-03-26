import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'QuotingHub — Quoting Software for Interior Designers'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#1A1A18',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          fontFamily: 'Georgia, serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid texture overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 80% 20%, rgba(196,164,107,0.12) 0%, transparent 55%), radial-gradient(circle at 10% 80%, rgba(196,164,107,0.07) 0%, transparent 45%)',
            display: 'flex',
          }}
        />

        {/* Gold top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #C4A46B 0%, #9A7B4F 100%)',
            display: 'flex',
          }}
        />

        {/* Top: wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#F5F2EC',
              letterSpacing: '-0.5px',
              display: 'flex',
            }}
          >
            QuotingHub
          </div>
          <div
            style={{
              width: '1px',
              height: '24px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.5px',
              display: 'flex',
            }}
          >
            quotinghub.co.za
          </div>
        </div>

        {/* Centre: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              fontSize: '64px',
              fontWeight: '400',
              color: '#F5F2EC',
              lineHeight: '1.1',
              letterSpacing: '-1.5px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span style={{ display: 'flex' }}>Every project,</span>
            <span style={{ color: '#C4A46B', fontStyle: 'italic', display: 'flex' }}>
              perfectly quoted.
            </span>
          </div>
          <div
            style={{
              fontSize: '22px',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: '300',
              letterSpacing: '0.2px',
              display: 'flex',
            }}
          >
            Quoting · Invoicing · Purchase Orders
          </div>
        </div>

        {/* Bottom: feature pills */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {[
            'Real-time pricing',
            'PDF generation',
            'Supplier management',
            'Built for SA designers',
          ].map((label) => (
            <div
              key={label}
              style={{
                padding: '8px 16px',
                border: '1px solid rgba(196,164,107,0.35)',
                borderRadius: '100px',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'system-ui, sans-serif',
                display: 'flex',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
