import type { Metadata } from 'next'

// Studio gets its own app manifest so "Add to Home Screen" from here installs
// an app that opens on /studio — the site-wide manifest starts at the supplier
// portal login. Installing matters for offline use on iPad: Safari can clear a
// website's stored data after a week without a visit, but not a Home Screen
// app's, which is what keeps downloaded boards on the device.
export const metadata: Metadata = {
  manifest: '/studio-manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Studio',
    statusBarStyle: 'default',
  },
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children
}
