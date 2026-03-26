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
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        <div style={{ fontSize: '72px', color: '#C4A46B', display: 'flex' }}>
          QuotingHub
        </div>
        <div style={{ fontSize: '28px', color: 'rgba(255,255,255,0.6)', display: 'flex' }}>
          Quoting software for interior designers
        </div>
        <div style={{ fontSize: '18px', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
          quotinghub.co.za
        </div>
      </div>
    ),
    { ...size }
  )
}
