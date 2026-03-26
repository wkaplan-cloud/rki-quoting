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
          padding: '64px 80px 60px 80px',
        }}
      >
        {/* Gold top bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1200px',
            height: '4px',
            background: '#C4A46B',
            display: 'flex',
          }}
        />

        {/* Gold glow circle top-right */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '480px',
            height: '480px',
            borderRadius: '480px',
            background: 'rgba(196,164,107,0.10)',
            display: 'flex',
          }}
        />

        {/* Top: wordmark + url */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '10px',
                background: '#C4A46B',
                display: 'flex',
              }}
            />
            <div
              style={{
                fontSize: '26px',
                fontWeight: '700',
                color: '#F5F2EC',
                letterSpacing: '-0.5px',
                display: 'flex',
              }}
            >
              QuotingHub
            </div>
          </div>
          <div
            style={{
              width: '1px',
              height: '20px',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
            }}
          />
          <div
            style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.35)',
              display: 'flex',
            }}
          >
            quotinghub.co.za
          </div>
        </div>

        {/* Centre: headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              fontSize: '68px',
              fontWeight: '400',
              color: '#F5F2EC',
              lineHeight: '1.1',
              letterSpacing: '-2px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ display: 'flex' }}>Every project,</span>
            <span style={{ color: '#C4A46B', display: 'flex' }}>perfectly quoted.</span>
          </div>
          <div
            style={{
              fontSize: '22px',
              color: 'rgba(255,255,255,0.45)',
              fontWeight: '300',
              display: 'flex',
            }}
          >
            Quoting · Invoicing · Purchase Orders for Interior Designers
          </div>
        </div>

        {/* Bottom: pills */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Real-time pricing', 'PDF generation', 'Supplier management', 'Built for SA'].map(
            (label) => (
              <div
                key={label}
                style={{
                  padding: '8px 18px',
                  border: '1px solid rgba(196,164,107,0.4)',
                  borderRadius: '100px',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.55)',
                  display: 'flex',
                }}
              >
                {label}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  )
}
