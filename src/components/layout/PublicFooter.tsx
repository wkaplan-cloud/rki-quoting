import Link from 'next/link'
import Image from 'next/image'

const LINKS = [
  { href: '/',                      label: 'For Designers'      },
  { href: '/trades',                label: 'For Trades'         },
  { href: '/manufacturer',          label: 'For Manufacturers'  },
  { href: '/supplier-portal/login', label: 'Supplier Portal'    },
  { href: '/faq',                   label: 'FAQ'                },
  { href: '/terms',                 label: 'Terms'              },
  { href: '/privacy',               label: 'Privacy'            },
]

export function PublicFooter() {
  return (
    <footer className="border-t border-[#D8D3C8] py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/">
          <Image src="/logo.png" alt="QuotingHub" width={80} height={80} className="h-16 w-auto object-contain" />
        </Link>
        <p className="text-xs text-[#8A877F]">© {new Date().getFullYear()} QuotingHub · quotinghub.co.za</p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  )
}
