import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Check, ArrowRight, ChevronRight,
  FileText, Receipt, ClipboardList, Shield,
  MapPin, Bell, Users, Zap
} from 'lucide-react'
import { NavMobile } from '../../_components/NavMobile'

export const metadata: Metadata = {
  title: 'Quoting Software for South African Electricians | QuotingHub',
  description: 'Professional quoting, invoicing, COCs, job cards, and GPS staff management for South African electricians. SANS 10142-1 compliant COC. 30-day free trial.',
  alternates: { canonical: 'https://quotinghub.co.za/trades/electrician' },
  openGraph: {
    title: 'Quoting Software for South African Electricians | QuotingHub',
    description: 'Quotes, claims, COCs, job cards, and GPS clock-in — the complete business system for South African electricians.',
    url: 'https://quotinghub.co.za/trades/electrician',
    images: [{ url: 'https://quotinghub.co.za/og-image.png', width: 1200, height: 630 }],
  },
}

const schema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QuotingHub for Electricians',
  url: 'https://quotinghub.co.za/trades/electrician',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'All',
  description: 'Professional quoting, invoicing, COC, job cards, and staff management for South African electricians.',
  areaServed: { '@type': 'Country', name: 'South Africa' },
  creator: { '@type': 'Organization', name: 'QuotingHub', url: 'https://quotinghub.co.za' },
}

const FEATURES = [
  {
    icon: FileText,
    title: 'Professional quotes in minutes',
    desc: 'Build itemised quotes with labour, materials, and preliminaries. Send a branded PDF to your client — no Excel, no back-and-forth.',
  },
  {
    icon: Receipt,
    title: 'Progress claims & invoicing',
    desc: 'Submit monthly progress claims with percentage completion per line item. Issue invoices and track certified vs paid amounts.',
  },
  {
    icon: Shield,
    title: 'Digital COC — SANS 10142-1',
    desc: 'Complete the Certificate of Compliance digitally. Record test results, supply details, and tester information. Send the signed COC as a PDF directly to your client.',
  },
  {
    icon: ClipboardList,
    title: 'Job cards for every callout',
    desc: 'Create a job card for any callout, repair, or maintenance visit — linked to a quote or standalone. Field technicians fill in findings, work done, and resolution on site.',
  },
  {
    icon: MapPin,
    title: 'GPS clock-in / clock-out',
    desc: 'Staff clock in and out from their phone. GPS coordinates are captured automatically, giving you accurate timesheets and site presence records.',
  },
  {
    icon: Bell,
    title: 'Real-time notifications',
    desc: 'Get notified the moment a technician clocks in, submits a job card, or completes a job. Stay across every project without being on site.',
  },
  {
    icon: Users,
    title: 'Staff & team management',
    desc: 'Invite staff to the system with a secure email link. Manage roles, track timesheets, and see who is on site at any time — from your phone or desktop.',
  },
  {
    icon: Zap,
    title: 'Variation orders & site instructions',
    desc: 'Manage variations professionally. Issue a variation order, get client sign-off, and track the approved value — all linked back to the original quote.',
  },
]

const INCLUDE_ITEMS = [
  'Unlimited quotes and projects',
  'Progress claims and invoices',
  'Digital COC (SANS 10142-1)',
  'Job cards — linked or standalone',
  'GPS clock-in / clock-out for all staff',
  'Real-time notifications',
  'Staff account management',
  'Variation orders',
  'As-built drawings section',
  'Client portal for approvals',
  'Branded PDF documents',
  '30-day free trial, no credit card',
]

const FAQS = [
  {
    q: 'Is the COC compliant with SANS 10142-1?',
    a: 'Yes. The digital COC captures all required information under SANS 10142-1 and the Electrical Installations Regulations 2009 — supply authority, earthing method, test results, tester registration number, and more. It generates a PDF that matches the official format.',
  },
  {
    q: 'Can my staff use it from their phones?',
    a: 'Yes. Staff log in at the same URL and get a mobile-optimised view. They can clock in/out with GPS, fill in job card reports, upload site photos, and capture client signatures — all from their phone, even on site.',
  },
  {
    q: 'Does it work for both large projects and small callouts?',
    a: 'Yes. For large projects you use the full quoting workflow — quotes, progress claims, variation orders, as-built, COC. For callouts and maintenance, you create a standalone job card in seconds. Both workflows live in the same system.',
  },
  {
    q: 'Can I have multiple admin users?',
    a: 'Yes. You can invite additional admin users to your organisation — for example a bookkeeper or a second director. Each person logs in with their own account.',
  },
  {
    q: 'Is there a long-term contract?',
    a: 'No. Month-to-month, cancel any time. Start with a 30-day free trial — no credit card required.',
  },
]

export default function ElectricianLandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F2EC] font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
      />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#F5F2EC]/90 backdrop-blur-sm border-b border-[#D8D3C8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 sm:h-32 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="QuotingHub" width={220} height={220} className="h-16 sm:h-28 w-auto max-w-[160px] sm:max-w-[220px] object-contain" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/trades" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">For Trades</Link>
            <Link href="/" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">For Designers</Link>
            <Link href="/supplier-portal/login" className="hidden sm:block px-4 py-2 text-sm text-[#2C2C2A] hover:text-[#9A7B4F] transition-colors font-medium">Log in</Link>
            <Link href="/supplier-portal/register?type=trades"
              className="hidden sm:inline-flex px-4 py-2 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Start free trial
            </Link>
            <NavMobile />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* Text */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-[#9A7B4F]/10 border border-[#9A7B4F]/25 rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />
                <span className="text-xs font-medium text-[#9A7B4F] tracking-wide">Built for South African electricians</span>
              </div>
              <h1 className="font-serif text-5xl md:text-6xl text-[#1A1A18] leading-[1.05] tracking-tight mb-5">
                The complete business<br />
                system for electricians.<br />
                <em className="text-[#C4A46B] not-italic">Built for South Africa.</em>
              </h1>
              <p className="text-xl text-[#8A877F] leading-relaxed mb-4 max-w-2xl">
                Quotes, progress claims, COCs, job cards, GPS staff tracking, and real-time notifications — everything you need to run a professional electrical business, in one system.
              </p>
              <p className="text-base text-[#8A877F] leading-relaxed mb-10 max-w-xl">
                Stop quoting from Excel. Stop losing job cards. Stop chasing timesheets. QuotingHub gives you a professional, digital operation from day one.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/supplier-portal/register?type=trades"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#1A1A18] text-[#F5F2EC] text-sm font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
                  Start your free trial <ArrowRight size={15} />
                </Link>
                <Link href="/supplier-portal/login"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 border border-[#D8D3C8] text-[#2C2C2A] text-sm font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white">
                  Log in to your account
                </Link>
              </div>
              <p className="text-sm text-[#C4BFB5] mt-4">30-day free trial · then R1,999/month excl. VAT · Cancel any time</p>
            </div>

            {/* Electrician illustration */}
            <div className="flex-shrink-0 w-full lg:w-[380px] flex items-center justify-center">
              <svg viewBox="0 0 360 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[360px]">
                <defs>
                  <filter id="elec-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#1A1A18" floodOpacity="0.10"/>
                  </filter>
                  <filter id="badge-shadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#1A1A18" floodOpacity="0.10"/>
                  </filter>
                </defs>

                {/* Background glow */}
                <circle cx="180" cy="300" r="190" fill="#9A7B4F" fillOpacity="0.05"/>

                {/* Ground shadow */}
                <ellipse cx="178" cy="472" rx="85" ry="11" fill="#1A1A18" fillOpacity="0.07"/>

                {/* ── Boots ── */}
                <path d="M152 432 Q146 448 132 455 L172 455 L172 432 Z" fill="#111827" rx="4"/>
                <path d="M188 432 Q188 448 202 455 L242 455 L228 432 Z" fill="#111827"/>
                <rect x="132" y="450" width="40" height="8" rx="4" fill="#1F2937"/>
                <rect x="202" y="450" width="40" height="8" rx="4" fill="#1F2937"/>

                {/* ── Legs ── */}
                <rect x="152" y="332" width="44" height="105" rx="10" fill="#374151"/>
                <rect x="164" y="340" width="6" height="85" rx="3" fill="#1F2937" fillOpacity="0.18"/>
                <rect x="184" y="332" width="44" height="105" rx="10" fill="#374151"/>
                <rect x="196" y="340" width="6" height="85" rx="3" fill="#1F2937" fillOpacity="0.18"/>

                {/* ── Belt ── */}
                <rect x="147" y="326" width="96" height="13" rx="6" fill="#1F2937"/>
                <rect x="172" y="323" width="16" height="17" rx="3" fill="#6B7280"/>
                <rect x="175" y="326" width="10" height="11" rx="2" fill="#4B5563"/>

                {/* ── Torso — blue shirt ── */}
                <path d="M122 238 Q138 218 180 215 Q222 218 238 238 L248 332 L112 332 Z" fill="#1E3A8A"/>

                {/* ── High-vis vest panels ── */}
                <path d="M122 238 Q134 220 168 216 L170 332 L112 332 Z" fill="#F59E0B"/>
                <path d="M238 238 Q226 220 192 216 L190 332 L248 332 Z" fill="#F59E0B"/>

                {/* Reflective stripes */}
                <rect x="112" y="274" width="58" height="8" rx="3" fill="#FEF9C3" fillOpacity="0.95"/>
                <rect x="190" y="274" width="58" height="8" rx="3" fill="#FEF9C3" fillOpacity="0.95"/>
                <rect x="112" y="290" width="58" height="8" rx="3" fill="#FEF9C3" fillOpacity="0.95"/>
                <rect x="190" y="290" width="58" height="8" rx="3" fill="#FEF9C3" fillOpacity="0.95"/>

                {/* Collar */}
                <path d="M168 216 L180 238 L192 216" fill="#1E3A8A"/>

                {/* ── Left arm (holding voltage tester) ── */}
                <path d="M122 248 Q82 272 76 322" stroke="#1E3A8A" strokeWidth="30" strokeLinecap="round"/>
                <path d="M80 306 Q76 320 76 330" stroke="#FBBF87" strokeWidth="26" strokeLinecap="round"/>
                <circle cx="76" cy="338" r="18" fill="#FBBF87"/>
                {/* Voltage tester */}
                <rect x="65" y="326" width="14" height="58" rx="5" fill="#1F2937" filter="url(#elec-shadow)"/>
                <rect x="67" y="316" width="10" height="16" rx="3" fill="#374151"/>
                <circle cx="72" cy="319" r="5" fill="#EF4444"/>
                <rect x="68" y="377" width="8" height="14" rx="2" fill="#9CA3AF"/>

                {/* ── Right arm (holding phone) ── */}
                <path d="M238 248 Q278 268 284 308" stroke="#1E3A8A" strokeWidth="30" strokeLinecap="round"/>
                <path d="M280 294 Q284 308 284 318" stroke="#FBBF87" strokeWidth="26" strokeLinecap="round"/>
                <circle cx="284" cy="326" r="18" fill="#FBBF87"/>

                {/* ── Phone ── */}
                <rect x="290" y="260" width="58" height="100" rx="11" fill="white" filter="url(#elec-shadow)"/>
                <rect x="294" y="268" width="50" height="82" rx="7" fill="#F5F2EC"/>
                {/* Phone notch */}
                <rect x="307" y="261" width="20" height="8" rx="4" fill="#E5E1DB"/>
                {/* App UI */}
                <rect x="298" y="275" width="30" height="5" rx="2" fill="#C4A46B"/>
                <rect x="298" y="284" width="42" height="3" rx="1" fill="#D8D3C8"/>
                <rect x="298" y="291" width="36" height="3" rx="1" fill="#D8D3C8"/>
                <rect x="298" y="300" width="42" height="15" rx="3" fill="#EDE9E1"/>
                <rect x="302" y="304" width="22" height="3" rx="1" fill="#9A7B4F" fillOpacity="0.8"/>
                <rect x="302" y="309" width="30" height="2" rx="1" fill="#D8D3C8"/>
                <rect x="298" y="320" width="42" height="15" rx="3" fill="#EDE9E1"/>
                <rect x="302" y="324" width="28" height="3" rx="1" fill="#9A7B4F" fillOpacity="0.8"/>
                <rect x="302" y="329" width="18" height="2" rx="1" fill="#D8D3C8"/>
                <rect x="298" y="338" width="42" height="9" rx="4" fill="#1A1A18"/>

                {/* ── Neck ── */}
                <rect x="168" y="207" width="24" height="20" rx="5" fill="#FBBF87"/>

                {/* ── Head ── */}
                <ellipse cx="180" cy="170" rx="52" ry="54" fill="#FBBF87"/>
                {/* Ears */}
                <ellipse cx="128" cy="172" rx="10" ry="13" fill="#FBBF87"/>
                <ellipse cx="232" cy="172" rx="10" ry="13" fill="#FBBF87"/>

                {/* Eyes */}
                <circle cx="162" cy="162" r="9" fill="white"/>
                <circle cx="198" cy="162" r="9" fill="white"/>
                <circle cx="164" cy="163" r="6" fill="#1F2937"/>
                <circle cx="200" cy="163" r="6" fill="#1F2937"/>
                <circle cx="165" cy="161" r="2.5" fill="white"/>
                <circle cx="201" cy="161" r="2.5" fill="white"/>

                {/* Eyebrows */}
                <path d="M151 149 Q162 142 173 149" stroke="#92400E" strokeWidth="3.5" strokeLinecap="round"/>
                <path d="M187 149 Q198 142 209 149" stroke="#92400E" strokeWidth="3.5" strokeLinecap="round"/>

                {/* Smile */}
                <path d="M164 182 Q180 198 196 182" stroke="#B45309" strokeWidth="3" fill="none" strokeLinecap="round"/>

                {/* Cheeks */}
                <circle cx="148" cy="180" r="13" fill="#FB7185" fillOpacity="0.2"/>
                <circle cx="212" cy="180" r="13" fill="#FB7185" fillOpacity="0.2"/>

                {/* ── Hard hat ── */}
                {/* Dome */}
                <path d="M108 122 Q112 70 180 65 Q248 70 252 122 Z" fill="#F59E0B"/>
                {/* Dome highlight */}
                <path d="M128 88 Q150 72 172 76" stroke="#FDE68A" strokeWidth="5" strokeLinecap="round" fillOpacity="0.8"/>
                {/* Brim */}
                <ellipse cx="180" cy="122" rx="78" ry="16" fill="#D97706"/>
                {/* Brim top face */}
                <ellipse cx="180" cy="118" rx="78" ry="14" fill="#F59E0B"/>
                {/* Inner band shadow */}
                <ellipse cx="180" cy="121" rx="60" ry="10" fill="#D97706" fillOpacity="0.5"/>

                {/* Lightning bolt on hat */}
                <polygon points="184,78 177,94 183,94 176,112 190,92 184,92" fill="#1F2937" fillOpacity="0.65"/>

                {/* ── Floating badge: check ── */}
                <circle cx="54" cy="210" r="30" fill="#16A34A" fillOpacity="0.10"/>
                <circle cx="54" cy="210" r="23" fill="white" filter="url(#badge-shadow)"/>
                <path d="M43 210 L51 219 L65 200" stroke="#16A34A" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

                {/* ── Floating badge: lightning ── */}
                <circle cx="316" cy="155" r="26" fill="#C4A46B" fillOpacity="0.12"/>
                <circle cx="316" cy="155" r="20" fill="white" filter="url(#badge-shadow)"/>
                <polygon points="319,143 313,155 318,155 312,168 322,155 317,155" fill="#C4A46B"/>
              </svg>
            </div>

          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <div className="border-y border-[#D8D3C8] bg-white py-5 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {[
            'Professional quotes in minutes',
            'Digital COC — SANS 10142-1',
            'GPS clock-in for all staff',
            'Job cards on any device',
            '30-day free trial',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-[#8A877F]">
              <Check size={13} className="text-[#C4A46B] flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <section className="py-24 px-6 bg-white border-y border-[#D8D3C8] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: '300px 300px' }} />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight">
              One system. Every workflow.
            </h2>
            <p className="text-[#8A877F] text-lg mt-4 max-w-xl mx-auto leading-relaxed">
              From the first quote to the final COC, every part of your business runs through QuotingHub.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group p-6 rounded-xl border border-[#EDE9E1] hover:border-[#C4A46B]/40 hover:bg-[#F5F2EC] transition-all duration-200">
                <div className="w-10 h-10 rounded-lg bg-[#9A7B4F]/10 flex items-center justify-center mb-4 group-hover:bg-[#9A7B4F]/20 transition-colors">
                  <Icon size={18} className="text-[#9A7B4F]" />
                </div>
                <h3 className="font-medium text-[#1A1A18] mb-2 text-sm leading-snug">{title}</h3>
                <p className="text-sm text-[#8A877F] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COC callout — dark block */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl bg-[#1A1A18] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#C4A46B]/8 translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="relative p-10 md:p-16 flex flex-col md:flex-row items-start md:items-center gap-10">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-[#C4A46B]/15 border border-[#C4A46B]/25 rounded-full px-4 py-1.5 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C4A46B]" />
                  <span className="text-xs font-medium text-[#C4A46B] tracking-wide uppercase">SANS 10142-1 Compliant</span>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl text-white leading-tight tracking-tight mb-4">
                  Digital COC.<br />No more paper forms.
                </h2>
                <p className="text-white/60 text-lg leading-relaxed mb-6 max-w-lg">
                  Complete your Certificate of Compliance digitally — supply authority, earthing, test results, tester registration, and client details. Send the signed COC as a professional PDF straight to the client's inbox.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    'All SANS 10142-1 required fields captured',
                    'Pass/fail/N-A test result toggles for all 6 categories',
                    'Tester registration number and details',
                    'Send to client as a PDF with one click',
                    'Linked to the original quote and project',
                  ].map(i => (
                    <li key={i} className="flex items-start gap-3 text-sm text-white/75">
                      <Check size={14} className="text-[#C4A46B] flex-shrink-0 mt-0.5" />
                      {i}
                    </li>
                  ))}
                </ul>
                <Link href="/supplier-portal/register?type=trades"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#9A7B4F] text-white text-sm font-medium rounded-lg hover:bg-[#B8956A] transition-colors">
                  Start free trial <ArrowRight size={14} />
                </Link>
              </div>
              <div className="hidden md:flex flex-col items-center justify-center w-48 flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-[#C4A46B]/15 flex items-center justify-center mb-4">
                  <Shield size={36} className="text-[#C4A46B]" />
                </div>
                <p className="text-white/30 text-xs text-center leading-relaxed">Electrical Installations Regulations 2009</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="py-20 px-6 bg-white border-y border-[#D8D3C8]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">What you get</p>
            <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight mb-4">
              Everything included from day one.
            </h2>
            <div className="inline-flex items-baseline gap-1.5">
              <span className="text-4xl font-bold text-[#1A1A18]">R1,999</span>
              <span className="text-base text-[#8A877F]">/month excl. VAT</span>
            </div>
            <p className="text-sm text-[#C4BFB5] mt-1">30-day free trial · No credit card required</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {INCLUDE_ITEMS.map(item => (
              <div key={item} className="flex items-center gap-3 p-4 rounded-xl border border-[#EDE9E1] bg-[#F5F2EC]">
                <Check size={14} className="text-[#C4A46B] flex-shrink-0" />
                <span className="text-sm text-[#2C2C2A]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-medium text-[#9A7B4F] uppercase tracking-widest mb-3">Questions</p>
            <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18] tracking-tight">
              Frequently asked
            </h2>
          </div>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="p-6 rounded-xl border border-[#EDE9E1] bg-white">
                <p className="font-medium text-[#1A1A18] mb-2 text-sm">{q}</p>
                <p className="text-sm text-[#8A877F] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 bg-white border-t border-[#D8D3C8]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl md:text-5xl text-[#1A1A18] tracking-tight mb-5">
            Ready to run a more professional electrical business?
          </h2>
          <p className="text-[#8A877F] text-lg mb-10">
            Start your free trial today. No credit card, no commitment — just a better way to work.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/supplier-portal/register?type=trades"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#1A1A18] text-[#F5F2EC] font-medium rounded-lg hover:bg-[#9A7B4F] transition-colors">
              Start free trial <ChevronRight size={16} />
            </Link>
            <Link href="/trades"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-[#D8D3C8] text-[#2C2C2A] font-medium rounded-lg hover:border-[#9A7B4F] hover:text-[#9A7B4F] transition-colors bg-white">
              Other trades
            </Link>
          </div>
          <p className="text-sm text-[#C4BFB5] mt-5">30-day free trial · No credit card required · Cancel any time</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#D8D3C8] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/">
            <Image src="/logo.png" alt="QuotingHub" width={80} height={80} className="h-16 w-auto object-contain" />
          </Link>
          <p className="text-xs text-[#8A877F]">© {new Date().getFullYear()} QuotingHub · quotinghub.co.za</p>
          <div className="flex items-center gap-5">
            <Link href="/" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">For Designers</Link>
            <Link href="/trades" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">For Trades</Link>
            <Link href="/terms" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Terms</Link>
            <Link href="/privacy" className="text-xs text-[#8A877F] hover:text-[#9A7B4F] transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
