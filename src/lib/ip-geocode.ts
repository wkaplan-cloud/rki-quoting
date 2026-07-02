export interface IpLocation {
  latitude: number
  longitude: number
  city: string | null
}

// Extract the real client IP from Vercel / proxy headers
export function clientIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

// ipapi.co free tier — 1 000 req/day, no key needed
export async function ipGeocode(ip: string): Promise<IpLocation | null> {
  // Skip loopback / private ranges (local dev, Vercel internal)
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.')) return null
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'RKI-QuotingHub/1.0' },
    })
    if (!r.ok) return null
    const d = await r.json() as { latitude?: number; longitude?: number; city?: string; error?: boolean }
    if (d.error || !d.latitude || !d.longitude) return null
    return { latitude: d.latitude, longitude: d.longitude, city: d.city ?? null }
  } catch {
    return null
  }
}
