// Module-level cache so repeated calls for the same coords don't hit the network
const cache = new Map<string, string>()

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

function formatAddress(d: { address?: Record<string, string>; display_name?: string }): string | null {
  const a = d.address ?? {}
  const road = a.road ?? a.pedestrian ?? a.highway ?? a.path
  const area = a.suburb ?? a.city_district ?? a.neighbourhood ?? a.town ?? a.city ?? a.village
  if (road && area) return `${road}, ${area}`
  if (area) return area
  if (d.display_name) return d.display_name.split(',').slice(0, 2).join(',').trim()
  return null
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = cacheKey(lat, lng)
  if (cache.has(key)) return cache.get(key)!
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'RKI-QuotingHub/1.0' } }
    )
    if (!r.ok) return null
    const d = await r.json() as { address?: Record<string, string>; display_name?: string }
    const label = formatAddress(d)
    if (label) cache.set(key, label)
    return label
  } catch {
    return null
  }
}
