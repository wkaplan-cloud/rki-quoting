import { ImageResponse } from 'next/og'
import fs from 'fs'
import path from 'path'

export const alt = 'QuotingHub — Quoting Software for Interior Designers'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png')
  const logoData = fs.readFileSync(logoPath)
  const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`

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
            top: '0px',
            left: '0px',
            width: '1200px',
            height: '4px',
            background: '#C4A46B',
            display: 'flex',
          }}
        />

        {/* Soft glow — top right */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '500px',
            background: '#2A2318',
            display: 'flex',
          }}
        />

        {/* Soft glow — bottom left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-80px',
            width: '340px',
            height: '340px',
            borderRadius: '340px',
            background: '#221E14',
            display: 'flex',
          }}
        />

        {/* Top: logo on cream pill + url */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              background: '#F5F2EC',
              borderRadius: '12px',
              padding: '14px 28px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <img
              src={logoBase64}
              style={{ height: '108px', objectFit: 'contain' }}
            />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div
              style={{
                fontSize: '72px',
                fontWeight: '400',
                color: '#F5F2EC',
                lineHeight: '1.1',
                letterSpacing: '-2px',
                display: 'flex',
              }}
            >
              Every project,
            </div>
            <div
              style={{
                fontSize: '72px',
                fontWeight: '400',
                color: '#C4A46B',
                lineHeight: '1.1',
                letterSpacing: '-2px',
                fontStyle: 'italic',
                display: 'flex',
              }}
            >
              perfectly quoted.
            </div>
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

        {/* Bottom: feature pills */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Real-time pricing', 'PDF generation', 'Supplier management', 'Built for SA'].map(
            (label) => (
              <div
                key={label}
                style={{
                  padding: '9px 20px',
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
