import Link from 'next/link'
import Image from 'next/image'

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans flex flex-col">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 sm:h-32 flex items-center justify-between">
          <Link href="/"><Image src="/logo.png" alt="QuotingHub" width={220} height={220} className="h-16 sm:h-28 w-auto max-w-[160px] sm:max-w-[220px] object-contain" /></Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/blog" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Blog</Link>
            <Link href="/pricing" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Pricing</Link>
            <Link href="/faq" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">FAQ</Link>
            <Link href="/login" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href="/trades" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">For Trades</Link>
            <Link href="/supplier-portal" className="hidden sm:block px-3 py-2 text-sm font-medium rounded-lg border border-[#D8D3C8] text-[#9A7B4F] hover:bg-[#9A7B4F]/10 transition-colors">
              Supplier Portal
            </Link>
            <Link href="/signup" className="px-3 py-2 sm:px-4 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 pt-20 sm:pt-32">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D8D3C8] py-8 px-6 mt-16">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/"><Image src="/logo.png" alt="QuotingHub" width={80} height={80} className="h-20 w-auto object-contain" /></Link>
          <p className="text-xs text-[#8A877F]">© {new Date().getFullYear()} QuotingHub · quotinghub.co.za</p>
          <div className="flex items-center gap-5">
            <Link href="/faq" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">FAQ</Link>
            <Link href="/trades" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">For Trades</Link>
            <Link href="/supplier-portal" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Supplier Portal</Link>
            <Link href="/terms" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Terms</Link>
            <Link href="/privacy" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
