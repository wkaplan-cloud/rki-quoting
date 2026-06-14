import Link from 'next/link'
import Image from 'next/image'
import { NavMobile } from '@/app/_components/NavMobile'
import { NavDropdown } from '@/app/_components/NavDropdown'
import { PublicFooter } from './PublicFooter'

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans flex flex-col">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 sm:h-32 flex items-center justify-between">
          <Link href="/"><Image src="/logo.png" alt="QuotingHub" width={220} height={220} className="h-16 sm:h-28 w-auto max-w-[160px] sm:max-w-[220px] object-contain" /></Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <NavDropdown />
            <Link href="/pricing" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Pricing</Link>
            <Link href="/faq" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">FAQ</Link>
            <Link href="/blog" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Blog</Link>
            <Link href="/login" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href="/signup" className="px-3 py-2 sm:px-4 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Get started free
            </Link>
            <NavMobile />
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 pt-20 sm:pt-32">
        {children}
      </main>

      <div className="mt-16"><PublicFooter /></div>

    </div>
  )
}
